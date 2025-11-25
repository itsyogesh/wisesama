import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Main Redis client for caching
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 3) {
      console.warn('[Redis] Connection failed after 3 retries');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err.message);
});

// Cache helpers
const DEFAULT_TTL = 300; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
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
};
