import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

// Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiter for API requests (100 requests per minute per key)
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'wisesama:ratelimit',
});

// Cache helpers
const DEFAULT_TTL = 300; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key);
    return data;
  } catch (error) {
    console.error('[Redis] Cache get error:', error);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('[Redis] Cache set error:', error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error('[Redis] Cache delete error:', error);
  }
}

// Cache key generators
export const cacheKeys = {
  entity: (type: string, value: string) => `entity:${type}:${value}`,
  identity: (address: string, chain: string) => `identity:${chain}:${address}`,
  whitelist: (type: string, value: string) => `whitelist:${type}:${value}`,
  syncStatus: () => 'sync:status',
  reverseTwitter: (handle: string) => `reverse:twitter:${handle}`,
  reverseDomain: (domain: string) => `reverse:domain:${domain}`,
};
