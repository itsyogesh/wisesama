import type { PrismaClient } from '@wisesama/database';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../lib/auth', () => ({ auth: {} }));

import { createIntelAccess } from '../intel-access.middleware';

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup(state: 'active' | 'suspended' | 'missing' | 'failed') {
  const db = { user: { findUnique: vi.fn() } };
  if (state === 'failed') db.user.findUnique.mockRejectedValue(new Error('Unavailable'));
  else
    db.user.findUnique.mockResolvedValue(
      state === 'missing'
        ? null
        : { id: 'owner', intelSuspendedAt: state === 'suspended' ? new Date() : null },
    );
  const session: typeof import('../auth.middleware').authenticate = async (request) => {
    request.user = {
      id: 'owner',
      email: 'synthetic@example.invalid',
      role: 'ADMIN',
      tier: 'free',
      remainingQuota: 100,
    };
  };
  const access = createIntelAccess({
    db: db as unknown as Pick<PrismaClient, 'user'>,
    session,
    apiKey: session,
  });
  const app = Fastify();
  apps.push(app);
  const privateHandler = vi.fn(() => ({ private: true }));
  app.get('/session', { preHandler: access.authenticateIntel }, privateHandler);
  app.get('/api-key', { preHandler: access.authenticateIntelApiKey }, privateHandler);
  return { db, app, privateHandler };
}
describe('Wisesama-only account suspension', () => {
  it.each(['/session', '/api-key'])('checks live account state for %s', async (url) => {
    const { app, db } = await setup('active');
    expect((await app.inject({ url })).statusCode).toBe(200);
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'owner' },
      select: { id: true, intelSuspendedAt: true },
    });
    db.user.findUnique.mockResolvedValue({ id: 'owner', intelSuspendedAt: new Date() });
    expect((await app.inject({ url })).statusCode).toBe(403);
  });
  it.each([
    ['suspended', 403],
    ['missing', 401],
    ['failed', 503],
  ] as const)('fails closed for %s accounts', async (state, code) => {
    const { app, privateHandler } = await setup(state);
    expect((await app.inject({ url: '/session' })).statusCode).toBe(code);
    expect(privateHandler).not.toHaveBeenCalled();
  });
});
