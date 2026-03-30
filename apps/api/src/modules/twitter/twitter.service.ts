import { createHmac } from 'crypto';
import type { EntityType } from '@wisesama/types';
import { prisma } from '@wisesama/database';
import { redis } from '../../lib/redis';
import { QueryService } from '../../services/query.service';
import { detectEntityType } from '../../utils/entity-detector';
import { parseMention } from './twitter.parser';
import { formatCheckTweet, formatReportTweet } from './twitter.formatter';

const queryService = new QueryService();

const MAX_REPLIES_PER_POLL = 5;

const REDIS_KEYS = {
  lastMentionId: 'wisesama:twitter:last_mention_id',
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
  data?: Tweet[];
  includes?: { users?: TwitterUser[] };
  meta?: { newest_id?: string; result_count?: number };
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

export async function pollAndProcessMentions(): Promise<{ processed: number; replied: number; errors: number }> {
  const bearerToken = getBearerToken();
  const userId = getUserId();
  const lastMentionId = await redis.get<string>(REDIS_KEYS.lastMentionId);

  // Fetch new mentions
  const params = new URLSearchParams({
    'tweet.fields': 'text,author_id,created_at',
    'user.fields': 'username',
    expansions: 'author_id',
    max_results: '20',
  });
  if (lastMentionId) {
    params.set('since_id', lastMentionId);
  }

  const response = await fetch(`${X_API}/users/${userId}/mentions?${params}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Twitter] Failed to fetch mentions:', response.status, error);
    throw new Error(`Twitter API error: ${response.status}`);
  }

  const data = (await response.json()) as MentionsResponse;

  if (!data.data || data.data.length === 0) {
    return { processed: 0, replied: 0, errors: 0 };
  }

  // Build user lookup map
  const userMap = new Map<string, string>();
  for (const user of data.includes?.users ?? []) {
    userMap.set(user.id, user.username);
  }

  let processed = 0;
  let replied = 0;
  let errors = 0;

  for (const tweet of data.data) {
    processed++;

    // Cap replies per poll cycle to prevent spam abuse
    if (replied >= MAX_REPLIES_PER_POLL) break;

    try {
      // Skip if already replied
      const alreadyReplied = await redis.get(REDIS_KEYS.replied(tweet.id));
      if (alreadyReplied) continue;

      // Parse the mention
      const parsed = parseMention(tweet.text);
      if (!parsed || parsed.entities.length === 0) continue;

      const entity = parsed.entities[0]!;
      const author = userMap.get(tweet.author_id) ?? 'user';

      // Check entity cooldown
      const onCooldown = await redis.get(REDIS_KEYS.entityCooldown(entity));
      if (onCooldown) continue;

      let replyText: string;

      if (parsed.intent === 'CHECK') {
        const result = await queryService.checkEntity(entity);
        replyText = formatCheckTweet(result);
      } else {
        // REPORT intent
        const { type: entityType } = detectEntityType(entity);
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

      // Post reply
      await postReply(tweet.id, replyText);
      replied++;

      // Set dedup and cooldown
      await redis.setex(REDIS_KEYS.replied(tweet.id), 48 * 60 * 60, '1');
      await redis.setex(REDIS_KEYS.entityCooldown(entity), 5 * 60, '1');
    } catch (err) {
      console.error(`[Twitter] Error processing tweet ${tweet.id}:`, err);
      errors++;
    }
  }

  // Update last mention ID
  if (data.meta?.newest_id) {
    await redis.set(REDIS_KEYS.lastMentionId, data.meta.newest_id);
  }

  return { processed, replied, errors };
}

async function postReply(inReplyToTweetId: string, text: string): Promise<void> {
  // OAuth 1.0a is required for posting tweets as @wisesama_help
  // Using the user access token + secret for posting
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.warn('[Twitter] OAuth credentials not configured — skipping reply');
    return;
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: oauthHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Twitter] Failed to post reply:', response.status, error);
  }
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

function generateOAuth1Header(method: string, url: string, _body: unknown, creds: OAuthCredentials): string {
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
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
