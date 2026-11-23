import type { PrismaClient } from '@wisesama/database';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminGuard, createAdminJsonGuard } from '../admin-access';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const now = new Date('2026-11-05T10:00:00Z');
function fixture() {
  const user = {
    id: 'operator',
    email: 'operator@example.invalid',
    name: 'Test operator',
    role: 'ADMIN' as const,
    tier: 'free',
    remainingQuota: 100,
    intelAdmin: true,
    intelSuspendedAt: null,
  };
  const db = {
    session: { findFirst: vi.fn().mockResolvedValue({ id: 'session-1' }) },
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  };
  const getSession = vi
    .fn()
    .mockResolvedValue({ user: { id: 'operator' }, session: { id: 'session-1' } });
  return { db, getSession, user };
}
async function setup() {
  const app = Fastify();
  apps.push(app);
  const state = fixture();
  app.get(
    '/admin',
    {
      preHandler: createAdminGuard({
        db: state.db as unknown as PrismaClient,
        getSession: state.getSession,
        now: () => now,
      }),
    },
    (request) => ({ id: request.user!.id }),
  );
  return { app, ...state };
}
describe('dedicated v2 operator boundary', () => {
  it('rejects signed-out requests before consulting account data', async () => {
    const { app, getSession, db } = await setup();
    getSession.mockResolvedValue(null);
    expect((await app.inject('/admin')).statusCode).toBe(401);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('requires an unexpired matching persisted session even after a valid signed session', async () => {
    const { app, db } = await setup();
    db.session.findFirst.mockResolvedValue(null);
    expect((await app.inject('/admin')).statusCode).toBe(401);
    expect(db.session.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'operator', expiresAt: { gt: now } },
      select: { id: true },
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('does not let Dotsama ADMIN roles grant v2 access', async () => {
    const { app, db, user } = await setup();
    db.user.findUnique.mockResolvedValue({ ...user, intelAdmin: false });
    expect((await app.inject('/admin')).statusCode).toBe(403);
  });
  it('rechecks v2 privilege on every request and rejects revocation immediately', async () => {
    const { app, db, user } = await setup();
    expect((await app.inject('/admin')).statusCode).toBe(200);
    db.user.findUnique.mockResolvedValue({ ...user, intelAdmin: false });
    expect((await app.inject('/admin')).statusCode).toBe(403);
    expect(db.user.findUnique).toHaveBeenCalledTimes(2);
  });
  it('rejects suspended operators', async () => {
    const { app, db, user } = await setup();
    db.user.findUnique.mockResolvedValue({ ...user, intelSuspendedAt: now });
    expect((await app.inject('/admin')).statusCode).toBe(403);
  });
  it('validates JSON and a configured origin instead of trusting arbitrary hosts', async () => {
    const app = Fastify();
    apps.push(app);
    const run = vi.fn(() => ({ saved: true }));
    app.patch(
      '/admin',
      {
        preHandler: createAdminJsonGuard({
          NODE_ENV: 'production',
          INTEL_APP_URL: 'https://wisesama.example',
        }),
      },
      run,
    );
    for (const origin of [
      undefined,
      'https://attacker.invalid',
      'https://wisesama.example/path',
      'http://localhost:3002',
    ]) {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/admin',
            payload: {},
            headers: origin ? { origin } : {},
          })
        ).statusCode,
      ).toBe(403);
    }
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/admin',
          payload: '{}',
          headers: { origin: 'https://wisesama.example', 'content-type': 'text/plain' },
        })
      ).statusCode,
    ).toBe(415);
    expect(run).not.toHaveBeenCalled();
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/admin',
          payload: {},
          headers: { origin: 'https://wisesama.example' },
        })
      ).statusCode,
    ).toBe(200);
  });
  it('fails closed for invalid production origin configuration', async () => {
    const app = Fastify();
    apps.push(app);
    app.patch(
      '/admin',
      {
        preHandler: createAdminJsonGuard({
          NODE_ENV: 'production',
          INTEL_APP_URL: 'https://broken path',
        }),
      },
      () => ({ saved: true }),
    );
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/admin',
          payload: {},
          headers: { origin: 'http://localhost:3003' },
        })
      ).statusCode,
    ).toBe(403);
  });
});
