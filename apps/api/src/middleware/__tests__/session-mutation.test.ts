import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  key: vi.fn(),
  update: vi.fn(),
  alert: vi.fn(),
}));
vi.mock('@wisesama/database', () => ({
  prisma: { apiKey: { findUnique: mocks.key, update: mocks.update } },
}));
vi.mock('../../lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock('../../services/email.service', () => ({ sendApiKeyAlert: mocks.alert }));

import { authenticate, authenticateApiKey } from '../auth.middleware';

async function sessionRequest(
  method: 'GET' | 'POST',
  headers: Record<string, string | undefined> = {},
  payload?: string,
) {
  const app = Fastify();
  app.route({
    method: ['GET', 'POST'],
    url: '/private',
    preHandler: authenticate,
    handler: async () => ({ accepted: true }),
  });
  try {
    return await app.inject({ method, url: '/private', headers, payload });
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('INTEL_APP_URL', 'https://workspace.example.test');
  vi.stubEnv('CORS_ORIGIN', '');
  mocks.session.mockReset().mockResolvedValue({
    user: { id: 'dummy-user', email: 'dummy@example.test', role: 'USER', tier: 'free' },
  });
  mocks.key.mockReset();
  mocks.update.mockReset().mockResolvedValue({});
  mocks.alert.mockReset().mockResolvedValue({ success: true });
});
afterEach(() => vi.unstubAllEnvs());

describe('session mutation boundary', () => {
  it('allows authenticated reads without an Origin header', async () => {
    expect((await sessionRequest('GET')).statusCode).toBe(200);
  });

  it('accepts JSON only from an exact configured application origin', async () => {
    const result = await sessionRequest(
      'POST',
      {
        origin: 'https://workspace.example.test',
        'content-type': 'application/json; charset=utf-8',
      },
      '{}',
    );
    expect(result.statusCode).toBe(200);
  });

  it.each([
    {},
    { origin: 'null' },
    { origin: 'https://untrusted.example.test' },
    { origin: 'https://workspace.example.test.untrusted.test' },
    { origin: 'http://localhost:3003' },
    { referer: 'https://workspace.example.test/app' },
  ])('rejects an ambient-cookie mutation from an untrusted or missing origin: %j', async (headers) => {
    expect(
      (await sessionRequest('POST', { ...headers, 'content-type': 'application/json' }, '{}'))
        .statusCode,
    ).toBe(403);
  });

  it('rejects a simple text request even from an approved origin', async () => {
    expect(
      (
        await sessionRequest(
          'POST',
          { origin: 'https://workspace.example.test', 'content-type': 'text/plain' },
          'ordinary text',
        )
      ).statusCode,
    ).toBe(415);
  });

  it('retains local development origins outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(
      (
        await sessionRequest(
          'POST',
          { origin: 'http://localhost:3003', 'content-type': 'application/json' },
          '{}',
        )
      ).statusCode,
    ).toBe(200);
  });

  it('requires an authenticated session before a trusted-origin mutation', async () => {
    mocks.session.mockResolvedValue(null);
    expect(
      (
        await sessionRequest(
          'POST',
          { origin: 'https://workspace.example.test', 'content-type': 'application/json' },
          '{}',
        )
      ).statusCode,
    ).toBe(401);
  });
});

describe('API key usage alert recipient', () => {
  it.each([false, true])('requires mailbox verification (verified=%s)', async (emailVerified) => {
    mocks.key.mockResolvedValue({
      id: 'dummy-key',
      isActive: true,
      remainingQuota: 2000,
      name: 'Synthetic key',
      keyPrefix: 'dummy',
      user: {
        id: 'dummy-user',
        email: 'dummy@example.test',
        emailVerified,
        role: 'USER',
        tier: 'free',
        remainingQuota: 100,
      },
    });
    const app = Fastify();
    app.post('/key', { preHandler: authenticateApiKey }, async () => ({ accepted: true }));
    try {
      const result = await app.inject({
        method: 'POST',
        url: '/key',
        headers: { 'x-api-key': 'synthetic-local-key', 'content-type': 'application/json' },
        payload: '{}',
      });
      expect(result.statusCode).toBe(200);
      expect(mocks.update).toHaveBeenCalledTimes(1);
      expect(mocks.alert).toHaveBeenCalledTimes(emailVerified ? 1 : 0);
    } finally {
      await app.close();
    }
  });
});
