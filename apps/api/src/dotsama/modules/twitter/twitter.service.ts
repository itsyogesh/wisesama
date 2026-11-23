import { prisma } from '@wisesama/database';
import type { EntityType } from '@wisesama/types';
import { createHmac, randomUUID } from 'crypto';
import { redis } from '../../../lib/redis';
import { QueryService } from '../../services/query.service';
import { detectEntityType } from '../../utils/entity-detector';
import { formatCheckTweet, formatReportTweet } from './twitter.formatter';
import { parseMention } from './twitter.parser';

const queryService = new QueryService();

const MAX_REPLIES_PER_POLL = 5;
const MAX_MENTION_PAGES = 5;
const POLL_LEASE_MS = 60_000;
const X_REQUEST_TIMEOUT_MS = 15_000;

const REDIS_KEYS = {
  lastMentionId: 'wisesama:twitter:last_mention_id',
  pollWindow: 'wisesama:twitter:mention_window:v1',
  pollLease: 'wisesama:twitter:mention_poll_lease:v1',
  replied: (tweetId: string) => `wisesama:twitter:replied:${tweetId}`,
  entityCooldown: (entity: string) => `wisesama:twitter:entity_cooldown:${entity}`,
  dailyAlerts: 'wisesama:twitter:daily_alerts',
  dailyReplies: 'wisesama:twitter:daily_replies',
};

const X_API = 'https://api.x.com/2';

interface Tweet {
  id: string;
  text: string;
  author_id: string;
}

interface TwitterUser {
  id: string;
  username: string;
}

interface MentionsResponse {
  errors?: unknown[];
  data?: Tweet[];
  includes?: { users?: TwitterUser[] };
  meta?: { newest_id?: string; oldest_id?: string; result_count?: number; next_token?: string };
}

function getBearerToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) throw new Error('TWITTER_BEARER_TOKEN is not configured');
  return token;
}

function getUserId(): string {
  const id = process.env.TWITTER_USER_ID;
  if (!id) throw new Error('TWITTER_USER_ID is not configured');
  return id;
}

interface MentionWindow {
  version: 1;
  sinceId: string | null;
  highWaterId: string;
  untilId: string;
}

class MentionLeaseLostError extends Error {
  constructor() {
    super('Twitter mention poll lease lost');
  }
}

// Wrap the raw Redis value before Upstash deserializes it. A bare decimal ID
// can otherwise be decoded as a JavaScript number, including some unsafe integers.
const READ_CURSOR = `-- twitter:read-cursor
return cjson.encode({ id = redis.call('GET', KEYS[1]) or cjson.null })`;
const RENEW_LEASE = `-- twitter:renew-lease
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])`;
const WRITE_WINDOW = `-- twitter:write-window
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1`;
const COMPLETE_WINDOW = `-- twitter:complete-window
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('DEL', KEYS[3])
return 1`;
const MARK_REPLIED = `-- twitter:mark-replied
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SETEX', KEYS[2], ARGV[2], '1')
redis.call('SETEX', KEYS[3], ARGV[3], '1')
return 1`;
const RELEASE_LEASE = `-- twitter:release-lease
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])`;

function isTweetId(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,18})$/.test(value);
}

function compareTweetIds(left: string, right: string): number {
  return left.length === right.length
    ? left === right
      ? 0
      : left < right
        ? -1
        : 1
    : left.length - right.length;
}

function readWindow(value: unknown, sinceId: string | null): MentionWindow | null {
  if (value === null) return null;
  if (typeof value !== 'object' || value === null)
    throw new Error('Invalid Twitter mention window');
  const window = value as Partial<MentionWindow>;
  if (
    window.version !== 1 ||
    window.sinceId !== sinceId ||
    !isTweetId(window.highWaterId) ||
    !isTweetId(window.untilId) ||
    (sinceId !== null &&
      (compareTweetIds(window.untilId, sinceId) <= 0 ||
        compareTweetIds(window.highWaterId, sinceId) <= 0)) ||
    compareTweetIds(window.untilId, (BigInt(window.highWaterId) + 1n).toString()) > 0
  )
    throw new Error('Invalid Twitter mention window');
  return window as MentionWindow;
}

async function renewMentionLease(token: string): Promise<void> {
  const renewed = await redis.eval(RENEW_LEASE, [REDIS_KEYS.pollLease], [token, POLL_LEASE_MS]);
  if (renewed !== 1) throw new MentionLeaseLostError();
}

async function saveMentionWindow(token: string, window: MentionWindow): Promise<void> {
  const saved = await redis.eval(
    WRITE_WINDOW,
    [REDIS_KEYS.pollLease, REDIS_KEYS.pollWindow],
    [token, JSON.stringify(window), POLL_LEASE_MS],
  );
  if (saved !== 1) throw new MentionLeaseLostError();
}

async function completeMentionWindow(token: string, window: MentionWindow): Promise<void> {
  const completed = await redis.eval(
    COMPLETE_WINDOW,
    [REDIS_KEYS.pollLease, REDIS_KEYS.lastMentionId, REDIS_KEYS.pollWindow],
    [token, window.highWaterId],
  );
  if (completed !== 1) throw new MentionLeaseLostError();
}

export async function pollAndProcessMentions(): Promise<{
  processed: number;
  replied: number;
  errors: number;
}> {
  const bearerToken = getBearerToken();
  const userId = getUserId();
  const result = { processed: 0, replied: 0, errors: 0 };
  const token = randomUUID();
  const acquired = await redis.set(REDIS_KEYS.pollLease, token, { nx: true, px: POLL_LEASE_MS });
  if (acquired !== 'OK') return result;

  try {
    const cursor = await redis.eval<[], { id: unknown }>(
      READ_CURSOR,
      [REDIS_KEYS.lastMentionId],
      [],
    );
    if (cursor.id !== null && !isTweetId(cursor.id))
      throw new Error('Invalid Twitter mention cursor');
    const sinceId = cursor.id;
    let window = readWindow(await redis.get<unknown>(REDIS_KEYS.pollWindow), sinceId);
    let replyAttempts = 0;

    for (let page = 0; page < MAX_MENTION_PAGES; page++) {
      await renewMentionLease(token);
      const params = new URLSearchParams({
        'tweet.fields': 'text,author_id,created_at',
        'user.fields': 'username',
        expansions: 'author_id',
        max_results: '20',
      });
      if (sinceId !== null) params.set('since_id', sinceId);
      if (window) params.set('until_id', window.untilId);

      const response = await fetch(`${X_API}/users/${userId}/mentions?${params}`, {
        headers: { Authorization: `Bearer ${bearerToken}` },
        signal: AbortSignal.timeout(X_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Twitter API error: ${response.status}`);
      const data = (await response.json()) as MentionsResponse;
      await renewMentionLease(token);
      // Partial errors are not an exhausted timeline; keep the current bounds.
      if (data.errors?.length) throw new Error('Twitter returned incomplete mentions');
      const tweets = data.data ?? [];
      if (tweets.length > 20) throw new Error('Twitter mention page exceeds requested limit');
      let previousId = window?.untilId;
      for (const tweet of tweets) {
        if (
          !isTweetId(tweet.id) ||
          typeof tweet.text !== 'string' ||
          typeof tweet.author_id !== 'string' ||
          (sinceId !== null && compareTweetIds(tweet.id, sinceId) <= 0) ||
          (previousId !== undefined && compareTweetIds(tweet.id, previousId) >= 0)
        )
          throw new Error('Twitter mentions are outside the requested descending window');
        previousId = tweet.id;
      }

      if (tweets.length === 0) {
        if (data.meta?.next_token)
          throw new Error('Twitter returned an empty nonterminal mention page');
        if (window) await completeMentionWindow(token, window);
        return result;
      }
      if (!window) {
        const highWaterId = tweets[0]!.id;
        // until_id is exclusive. BigInt is used only for an exact successor;
        // provider IDs remain decimal strings in Redis, requests and comparisons.
        const untilId = (BigInt(highWaterId) + 1n).toString();
        if (!isTweetId(untilId)) throw new Error('Twitter mention ID exceeds supported bounds');
        window = { version: 1, sinceId, highWaterId, untilId };
        // Persist the frozen range before any intake. New arrivals wait for the
        // next completed window, even if this process exits before its first item.
        await saveMentionWindow(token, window);
      }
      const users = new Map((data.includes?.users ?? []).map((user) => [user.id, user.username]));

      for (const tweet of tweets) {
        if (replyAttempts >= MAX_REPLIES_PER_POLL) return result;
        result.processed++;
        let intakeComplete = false;
        try {
          await renewMentionLease(token);
          const alreadyReplied = await redis.get(REDIS_KEYS.replied(tweet.id));
          const parsed = parseMention(tweet.text);
          const entity = parsed?.entities[0];
          const onCooldown = entity ? await redis.get(REDIS_KEYS.entityCooldown(entity)) : false;
          let replyText: string | undefined;
          if (!alreadyReplied && parsed && entity && !onCooldown) {
            const author = users.get(tweet.author_id) ?? 'user';
            if (parsed.intent === 'CHECK') {
              const checked = await queryService.checkEntity(entity);
              replyText = formatCheckTweet(checked);
            } else {
              const { type: entityType } = detectEntityType(entity);
              await renewMentionLease(token);
              const report = await prisma.report.create({
                data: {
                  reportedValue: entity,
                  entityType: entityType as EntityType,
                  threatCategory: 'OTHER',
                  description: `Reported via X by @${author}: ${tweet.text.substring(0, 200)}`,
                  reporterName: `X: @${author}`,
                  status: 'pending',
                  evidenceUrls: [],
                },
              });
              replyText = formatReportTweet(entity, report.id, author);
            }
          }

          // A successful pending report is intake-complete independently of its
          // optional social reply. Failed inserts never move this upper bound.
          const nextWindow: MentionWindow = { ...window, untilId: tweet.id };
          await saveMentionWindow(token, nextWindow);
          window = nextWindow;
          intakeComplete = true;

          if (replyText && entity) {
            await renewMentionLease(token);
            replyAttempts++;
            if (await postReply(tweet.id, replyText)) {
              result.replied++;
              const marked = await redis.eval(
                MARK_REPLIED,
                [
                  REDIS_KEYS.pollLease,
                  REDIS_KEYS.replied(tweet.id),
                  REDIS_KEYS.entityCooldown(entity),
                ],
                [token, 48 * 60 * 60, 5 * 60],
              );
              if (marked !== 1) throw new MentionLeaseLostError();
            } else {
              result.errors++;
            }
          }
        } catch (err) {
          if (err instanceof MentionLeaseLostError) throw err;
          console.error(`[Twitter] Error processing tweet ${tweet.id}:`, err);
          result.errors++;
          // Retry this item before descending further; failed REPORT inserts
          // must not disappear behind a later checkpoint.
          if (!intakeComplete) return result;
        }
      }

      if (!data.meta?.next_token) {
        await completeMentionWindow(token, window);
        return result;
      }
      // Using the last intake-complete ID as exclusive until_id preserves page
      // suffixes across caps/restarts without retaining provider pagination tokens.
      if (replyAttempts >= MAX_REPLIES_PER_POLL) return result;
    }
    return result;
  } finally {
    // An expired worker must never release its successor's lease.
    await redis.eval(RELEASE_LEASE, [REDIS_KEYS.pollLease], [token]);
  }
}

async function postReply(inReplyToTweetId: string, text: string): Promise<boolean> {
  // OAuth 1.0a is required for posting tweets as @wisesama_help
  // Using the user access token + secret for posting
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.warn('[Twitter] OAuth credentials not configured — skipping reply');
    return false;
  }

  const url = `${X_API}/tweets`;
  const body = {
    text,
    reply: { in_reply_to_tweet_id: inReplyToTweetId },
  };

  // Generate OAuth 1.0a signature
  const oauthHeader = generateOAuth1Header('POST', url, body, {
    consumerKey: apiKey,
    consumerSecret: apiSecret,
    accessToken,
    accessTokenSecret: accessSecret,
  });

  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(X_REQUEST_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: oauthHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Twitter] Failed to post reply:', response.status, error);
    return false;
  }
  return true;
}

export async function postTweet(text: string): Promise<boolean> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.warn('[Twitter] OAuth credentials not configured — skipping tweet');
    return false;
  }

  const url = `${X_API}/tweets`;
  const body = { text };

  const oauthHeader = generateOAuth1Header('POST', url, body, {
    consumerKey: apiKey,
    consumerSecret: apiSecret,
    accessToken,
    accessTokenSecret: accessSecret,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: oauthHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Twitter] Failed to post tweet:', response.status, error);
    return false;
  }

  return true;
}

export async function canPostAlert(): Promise<boolean> {
  const count = await redis.get<number>(REDIS_KEYS.dailyAlerts);
  return (count ?? 0) < 3;
}

export async function incrementAlertCount(): Promise<void> {
  const key = REDIS_KEYS.dailyAlerts;
  const count = await redis.get<number>(key);
  if (count == null) {
    await redis.setex(key, 24 * 60 * 60, 1);
  } else {
    await redis.setex(key, 24 * 60 * 60, count + 1);
  }
}

// ---- OAuth 1.0a signature generation ----

interface OAuthCredentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function generateOAuth1Header(
  method: string,
  url: string,
  _body: unknown,
  creds: OAuthCredentials,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // Create signature base string
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join('&');

  const baseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`;

  // HMAC-SHA1 signature (required by Twitter OAuth 1.0a)
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  params['oauth_signature'] = signature;

  const headerString = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k]!)}"`)
    .join(', ');

  return `OAuth ${headerString}`;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
