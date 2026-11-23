import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  const expiresAt = new Map<string, number>();
  let clock = 0;
  function read(key: string) {
    if ((expiresAt.get(key) ?? Infinity) <= clock) {
      values.delete(key);
      expiresAt.delete(key);
    }
    return values.get(key) ?? null;
  }
  function write(key: string, value: string, ttl?: number) {
    values.set(key, value);
    if (ttl === undefined) expiresAt.delete(key);
    else expiresAt.set(key, clock + ttl);
  }
  // Draft in-memory model of the fenced Lua operations; no real Redis client.
  // Script behavior also needs integration verification when execution is allowed.
  const redis = {
    get: vi.fn(async (key: string) => {
      const value = read(key);
      if (value === null) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }),
    set: vi.fn(async (key: string, value: string, options: { nx?: boolean; px?: number }) => {
      if (options.nx && read(key) !== null) return null;
      write(key, value, options.px);
      return 'OK';
    }),
    eval: vi.fn(async (script: string, keys: string[], args: (string | number)[]) => {
      if (script.startsWith('-- twitter:read-cursor')) return { id: read(keys[0]!) };
      if (read(keys[0]!) !== args[0]) return 0;
      if (script.startsWith('-- twitter:renew-lease')) {
        expiresAt.set(keys[0]!, clock + Number(args[1]));
        return 1;
      }
      if (script.startsWith('-- twitter:write-window')) {
        write(keys[1]!, String(args[1]));
        expiresAt.set(keys[0]!, clock + Number(args[2]));
        return 1;
      }
      if (script.startsWith('-- twitter:complete-window')) {
        write(keys[1]!, String(args[1]));
        values.delete(keys[2]!);
        return 1;
      }
      if (script.startsWith('-- twitter:mark-replied')) {
        write(keys[1]!, '1', Number(args[1]) * 1000);
        write(keys[2]!, '1', Number(args[2]) * 1000);
        return 1;
      }
      if (script.startsWith('-- twitter:release-lease')) {
        values.delete(keys[0]!);
        expiresAt.delete(keys[0]!);
        return 1;
      }
      throw new Error('Unexpected Redis operation');
    }),
  };
  return {
    values,
    redis,
    read,
    write,
    advance: (ms: number) => {
      clock += ms;
    },
    reset: () => {
      values.clear();
      expiresAt.clear();
      clock = 0;
    },
    createReport: vi.fn(),
    checkEntity: vi.fn(),
  };
});

vi.mock('../../../../lib/redis', () => ({ redis: mocks.redis }));
vi.mock('@wisesama/database', () => ({ prisma: { report: { create: mocks.createReport } } }));
vi.mock('../../../services/query.service', () => ({
  QueryService: class {
    checkEntity = mocks.checkEntity;
  },
}));
vi.mock('../../../utils/entity-detector', () => ({ detectEntityType: () => ({ type: 'DOMAIN' }) }));
vi.mock('../twitter.formatter', () => ({
  formatCheckTweet: () => 'Synthetic check response',
  formatReportTweet: () => 'Synthetic report response',
}));

import { pollAndProcessMentions } from '../twitter.service';

const CURSOR = 'wisesama:twitter:last_mention_id';
const WINDOW = 'wisesama:twitter:mention_window:v1';
const LEASE = 'wisesama:twitter:mention_poll_lease:v1';
const BASE = 1_900_000_000_000_000_000n;
interface Mention {
  id: string;
  text: string;
  author_id: string;
}
function mentions(
  count: number,
  intent: 'REPORT' | 'CHECK' | 'IGNORE' = 'REPORT',
  base = BASE,
): Mention[] {
  return Array.from({ length: count }, (_, index) => ({
    id: (base - BigInt(index)).toString(),
    text:
      intent === 'IGNORE'
        ? '@wisesama_help hello'
        : `@wisesama_help ${intent.toLowerCase()} fraud${index}.example`,
    author_id: '101',
  }));
}
function provider(initial: Mention[], postStatus = 201) {
  const feed = [...initial];
  const gets: URL[] = [];
  const posts: string[] = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (init?.method === 'POST') {
      posts.push(
        (JSON.parse(String(init.body)) as { reply: { in_reply_to_tweet_id: string } }).reply
          .in_reply_to_tweet_id,
      );
      return new Response('', { status: postStatus });
    }
    gets.push(url);
    const since = url.searchParams.get('since_id');
    const until = url.searchParams.get('until_id');
    const eligible = feed.filter(
      (tweet) =>
        (since === null || BigInt(tweet.id) > BigInt(since)) &&
        (until === null || BigInt(tweet.id) < BigInt(until)),
    );
    const data = eligible.slice(0, 20);
    return Response.json({
      data,
      includes: { users: [{ id: '101', username: 'synthetic_author' }] },
      meta: {
        ...(eligible.length > data.length ? { next_token: 'more' } : {}),
        result_count: data.length,
      },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  return { feed, gets, posts, fetcher };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
function windowState() {
  const raw = mocks.read(WINDOW);
  return raw === null
    ? null
    : (JSON.parse(raw) as { sinceId: string | null; highWaterId: string; untilId: string });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reset();
  mocks.createReport.mockReset().mockResolvedValue({ id: 'synthetic-pending-report' });
  mocks.checkEntity.mockReset().mockResolvedValue({});
  vi.stubEnv('TWITTER_BEARER_TOKEN', 'synthetic-bearer');
  vi.stubEnv('TWITTER_USER_ID', '202');
  vi.stubEnv('TWITTER_API_KEY', 'synthetic-key');
  vi.stubEnv('TWITTER_API_SECRET', 'synthetic-secret');
  vi.stubEnv('TWITTER_ACCESS_TOKEN', 'synthetic-access');
  vi.stubEnv('TWITTER_ACCESS_SECRET', 'synthetic-access-secret');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('bounded mention intake windows', () => {
  it('retains a returned REPORT page suffix after five replies and drains it over later polls', async () => {
    const feed = mentions(12);
    const x = provider(feed);
    const lower = (BASE - 100n).toString();
    mocks.write(CURSOR, lower);

    expect(await pollAndProcessMentions()).toEqual({ processed: 5, replied: 5, errors: 0 });
    expect(mocks.read(CURSOR)).toBe(lower);
    expect(windowState()).toMatchObject({
      sinceId: lower,
      highWaterId: feed[0]!.id,
      untilId: feed[4]!.id,
    });
    expect(await pollAndProcessMentions()).toEqual({ processed: 5, replied: 5, errors: 0 });
    expect(x.gets[1]!.searchParams.get('until_id')).toBe(feed[4]!.id);
    expect(await pollAndProcessMentions()).toEqual({ processed: 2, replied: 2, errors: 0 });
    expect(mocks.createReport).toHaveBeenCalledTimes(12);
    expect(new Set(x.posts).size).toBe(12);
    expect(mocks.read(CURSOR)).toBe(feed[0]!.id);
    expect(windowState()).toBeNull();
    expect(
      mocks.createReport.mock.calls.every(([request]) => request.data.status === 'pending'),
    ).toBe(true);
  });

  it('retains older pages after five bounded fetches without moving the global cursor', async () => {
    const feed = mentions(105, 'IGNORE');
    for (let index = 100; index < feed.length; index++)
      feed[index]!.text = `@wisesama_help report fraud${index}.example`;
    const x = provider(feed);
    expect(await pollAndProcessMentions()).toEqual({ processed: 100, replied: 0, errors: 0 });
    expect(x.gets).toHaveLength(5);
    expect(mocks.read(CURSOR)).toBeNull();
    expect(windowState()!.untilId).toBe(feed[99]!.id);
    expect(await pollAndProcessMentions()).toEqual({ processed: 5, replied: 5, errors: 0 });
    expect(mocks.createReport).toHaveBeenCalledTimes(5);
    expect(x.gets[5]!.searchParams.get('until_id')).toBe(feed[99]!.id);
    expect(mocks.read(CURSOR)).toBe(feed[0]!.id);
  });

  it('freezes the high water mark while newer arrivals wait for the next window', async () => {
    const feed = mentions(8);
    const x = provider(feed);
    await pollAndProcessMentions();
    const newTweet = mentions(1, 'REPORT', BASE + 1n)[0]!;
    newTweet.text = '@wisesama_help report newest.example';
    x.feed.unshift(newTweet);
    expect(await pollAndProcessMentions()).toEqual({ processed: 3, replied: 3, errors: 0 });
    expect(x.posts).not.toContain(newTweet.id);
    expect(mocks.read(CURSOR)).toBe(feed[0]!.id);
    expect(await pollAndProcessMentions()).toEqual({ processed: 1, replied: 1, errors: 0 });
    expect(x.posts).toContain(newTweet.id);
  });

  it('retries a failed REPORT insert before descending or committing its window', async () => {
    const feed = mentions(3);
    const x = provider(feed);
    mocks.createReport.mockRejectedValueOnce(new Error('Synthetic insert failure'));
    expect(await pollAndProcessMentions()).toEqual({ processed: 1, replied: 0, errors: 1 });
    expect(windowState()!.untilId).toBe((BASE + 1n).toString());
    expect(mocks.read(CURSOR)).toBeNull();
    expect(x.posts).toEqual([]);
    expect(await pollAndProcessMentions()).toEqual({ processed: 3, replied: 3, errors: 0 });
    expect(mocks.createReport).toHaveBeenCalledTimes(4);
    expect(x.posts).toEqual(feed.map((tweet) => tweet.id));
  });

  it('retries a middle-page insert failure without skipping older pending intake', async () => {
    const feed = mentions(4);
    const x = provider(feed);
    mocks.createReport
      .mockResolvedValueOnce({ id: 'first' })
      .mockRejectedValueOnce(new Error('Synthetic failure'));
    expect(await pollAndProcessMentions()).toEqual({ processed: 2, replied: 1, errors: 1 });
    expect(windowState()!.untilId).toBe(feed[0]!.id);
    expect(mocks.read(CURSOR)).toBeNull();
    expect(await pollAndProcessMentions()).toEqual({ processed: 3, replied: 3, errors: 0 });
    expect(x.posts).toEqual(feed.map((tweet) => tweet.id));
  });

  it('treats a saved report as intake-complete when the optional X reply fails', async () => {
    const feed = mentions(8);
    const x = provider(feed, 503);
    expect(await pollAndProcessMentions()).toEqual({ processed: 5, replied: 0, errors: 5 });
    expect(x.posts).toHaveLength(5);
    expect(mocks.read(CURSOR)).toBeNull();
    expect(await pollAndProcessMentions()).toEqual({ processed: 3, replied: 0, errors: 3 });
    expect(mocks.createReport).toHaveBeenCalledTimes(8);
    expect(new Set(x.posts).size).toBe(8);
    expect(mocks.read(`wisesama:twitter:replied:${feed[0]!.id}`)).toBeNull();
    expect(mocks.read(CURSOR)).toBe(feed[0]!.id);
  });

  it('does not count missing OAuth as a successful reply', async () => {
    const feed = mentions(1);
    const x = provider(feed);
    vi.stubEnv('TWITTER_API_SECRET', '');
    expect(await pollAndProcessMentions()).toEqual({ processed: 1, replied: 0, errors: 1 });
    expect(mocks.createReport).toHaveBeenCalledTimes(1);
    expect(x.posts).toEqual([]);
    expect(mocks.read(CURSOR)).toBe(feed[0]!.id);
  });

  it('preserves CHECK parsing and intentional deduplication/cooldown skips', async () => {
    const feed = mentions(4, 'CHECK');
    provider(feed);
    mocks.write(`wisesama:twitter:replied:${feed[0]!.id}`, '1');
    mocks.write('wisesama:twitter:entity_cooldown:fraud1.example', '1');
    expect(await pollAndProcessMentions()).toEqual({ processed: 4, replied: 2, errors: 0 });
    expect(mocks.createReport).not.toHaveBeenCalled();
    expect(mocks.checkEntity).toHaveBeenCalledTimes(2);
  });

  it('keeps bare legacy cursor IDs exact even when the SDK could decode them as unsafe numbers', async () => {
    const lower = BASE.toString();
    mocks.write(CURSOR, lower);
    const feed = mentions(1, 'REPORT', BASE + 1n);
    const x = provider(feed);
    await pollAndProcessMentions();
    expect(x.gets[0]!.searchParams.get('since_id')).toBe(lower);
    expect(mocks.read(CURSOR)).toBe(feed[0]!.id);
    expect(mocks.redis.get).not.toHaveBeenCalledWith(CURSOR);
  });

  it('keeps the active window unchanged after provider errors and malformed ordering', async () => {
    const feed = mentions(6);
    const x = provider(feed);
    await pollAndProcessMentions();
    const original = mocks.read(WINDOW);
    x.fetcher.mockResolvedValueOnce(
      Response.json({ errors: [{ title: 'Synthetic partial error' }] }),
    );
    await expect(pollAndProcessMentions()).rejects.toThrow('incomplete mentions');
    expect(mocks.read(WINDOW)).toBe(original);
    x.fetcher.mockResolvedValueOnce(Response.json({ data: [feed[4], feed[5]] }));
    await expect(pollAndProcessMentions()).rejects.toThrow('descending window');
    expect(mocks.read(WINDOW)).toBe(original);
    expect(mocks.read(CURSOR)).toBeNull();
  });
});

describe('fenced mention poll lease', () => {
  it('does no provider or intake work while another poll owns an unexpired lease', async () => {
    const x = provider(mentions(1));
    mocks.write(LEASE, 'synthetic-other-owner', 60_000);
    expect(await pollAndProcessMentions()).toEqual({ processed: 0, replied: 0, errors: 0 });
    expect(x.fetcher).not.toHaveBeenCalled();
    expect(mocks.createReport).not.toHaveBeenCalled();
  });

  it('fences stale progress and release after an in-flight insert outlives its lease', async () => {
    provider(mentions(2));
    const insertStarted = deferred<void>();
    const firstInsert = deferred<{ id: string }>();
    mocks.createReport.mockImplementationOnce(() => {
      insertStarted.resolve();
      return firstInsert.promise;
    });
    const stale = pollAndProcessMentions();
    await insertStarted.promise;
    mocks.advance(60_001);
    expect(await pollAndProcessMentions()).toEqual({ processed: 2, replied: 2, errors: 0 });
    const committedCursor = mocks.read(CURSOR);
    // A third worker's lease must survive the stale worker's finally block.
    mocks.write(LEASE, 'synthetic-successor', 60_000);
    firstInsert.resolve({ id: 'late-insert' });
    await expect(stale).rejects.toThrow('lease lost');
    expect(mocks.read(CURSOR)).toBe(committedCursor);
    expect(mocks.read(WINDOW)).toBeNull();
    expect(mocks.read(LEASE)).toBe('synthetic-successor');
    // The database side effect can duplicate after lease expiry; the invariant
    // here is fenced progress, not exactly-once report creation.
    expect(mocks.createReport).toHaveBeenCalledTimes(3);
  });
});
