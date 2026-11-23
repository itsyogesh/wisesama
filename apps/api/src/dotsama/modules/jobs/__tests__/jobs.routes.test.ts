import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  constructReceiver: vi.fn(),
  verify: vi.fn(),
  syncPhishing: vi.fn(),
  syncChain: vi.fn(),
}));
vi.mock('@upstash/qstash', () => ({
  Receiver: class {
    verify = mocks.verify;
    constructor(options: unknown) {
      mocks.constructReceiver(options);
    }
  },
}));
vi.mock('../../../services/phishing-sync.service', () => ({
  phishingSyncService: { syncPhishingList: mocks.syncPhishing },
}));
vi.mock('../../../services/identity-sync.service', () => ({
  identitySyncService: { syncChain: mocks.syncChain },
}));

const apps: ReturnType<typeof Fastify>[] = [];
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', '');
  vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', '');
  mocks.verify.mockResolvedValue(false);
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
});

async function setup() {
  const { jobsRoutes } = await import('../jobs.routes');
  const app = Fastify();
  apps.push(app);
  await app.register(jobsRoutes);
  return app;
}

describe('scheduler signing configuration', () => {
  it.each([
    ['', ''],
    ['configured-current-slot', ''],
    ['', 'configured-next-slot'],
  ])('rejects both scheduled jobs with an incomplete key pair (%s, %s)', async (current, next) => {
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', current);
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', next);
    const app = await setup();
    expect(mocks.constructReceiver).not.toHaveBeenCalled();
    for (const url of ['/jobs/sync-phishing', '/jobs/sync-identities']) {
      const response = await app.inject({ method: 'POST', url, payload: { chain: 'polkadot' } });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'Signature verification failed' });
    }
    expect(mocks.constructReceiver).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.syncPhishing).not.toHaveBeenCalled();
    expect(mocks.syncChain).not.toHaveBeenCalled();
  });

  it('does not skip the guard for a next-only key in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'configured-next-slot');
    const app = await setup();
    const response = await app.inject({ method: 'POST', url: '/jobs/sync-phishing', payload: {} });
    expect(response.statusCode).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.syncPhishing).not.toHaveBeenCalled();
  });

  it('constructs a configured verifier lazily and still honors verification failure', async () => {
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'configured-current-slot');
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'configured-next-slot');
    const app = await setup();
    expect(mocks.constructReceiver).not.toHaveBeenCalled();
    const response = await app.inject({ method: 'POST', url: '/jobs/sync-phishing', payload: {} });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Invalid signature' });
    expect(mocks.constructReceiver).toHaveBeenCalledWith({
      currentSigningKey: 'configured-current-slot',
      nextSigningKey: 'configured-next-slot',
    });
    expect(mocks.verify).toHaveBeenCalledOnce();
    expect(mocks.syncPhishing).not.toHaveBeenCalled();
  });
});
