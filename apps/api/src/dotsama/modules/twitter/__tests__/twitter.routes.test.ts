import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), construct: vi.fn(), poll: vi.fn() }));
vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    verify = mocks.verify;
    constructor(options: unknown) {
      mocks.construct(options);
    }
  },
}));
vi.mock('../twitter.service', () => ({ pollAndProcessMentions: mocks.poll }));
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', '');
  vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', '');
  vi.stubEnv('TWITTER_BEARER_TOKEN', 'dummy-local-only');
  vi.stubEnv('TWITTER_USER_ID', '1');
  mocks.verify.mockResolvedValue(false);
  mocks.poll.mockResolvedValue({ processed: 0, replied: 0, errors: 0 });
});
afterEach(() => vi.unstubAllEnvs());

describe('Twitter scheduler configuration', () => {
  it.each([
    ['', 'next'],
    ['current', ''],
  ])('rejects an incomplete pair in development', async (current, next) => {
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', current);
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', next);
    const { twitterRoutes } = await import('../twitter.routes');
    const app = Fastify();
    await app.register(twitterRoutes);
    try {
      const response = await app.inject({ method: 'POST', url: '/jobs/twitter-poll', payload: {} });
      expect(response.statusCode).toBe(401);
      expect(mocks.construct).not.toHaveBeenCalled();
      expect(mocks.poll).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('requires verification in production with neither key configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { twitterRoutes } = await import('../twitter.routes');
    const app = Fastify();
    await app.register(twitterRoutes);
    try {
      expect(
        (await app.inject({ method: 'POST', url: '/jobs/twitter-poll', payload: {} })).statusCode,
      ).toBe(401);
      expect(mocks.poll).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('does not poll when configured verification returns false', async () => {
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current');
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'next');
    const { twitterRoutes } = await import('../twitter.routes');
    const app = Fastify();
    await app.register(twitterRoutes);
    try {
      expect(
        (await app.inject({ method: 'POST', url: '/jobs/twitter-poll', payload: {} })).statusCode,
      ).toBe(401);
      expect(mocks.verify).toHaveBeenCalledOnce();
      expect(mocks.poll).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
