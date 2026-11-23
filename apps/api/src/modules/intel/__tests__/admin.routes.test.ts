import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminJsonGuard } from '../../../middleware/admin-access';
import { IntelAdminError } from '../../../services/admin.service';
import { createIntelAdminRoutes } from '../admin.routes';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../../lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup(allowed = true) {
  const app = Fastify();
  apps.push(app);
  const service = {
    overview: vi.fn().mockResolvedValue({ users: { total: 0 } }),
    users: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    user: vi.fn(),
    access: vi.fn().mockResolvedValue({ user: {} }),
    advisories: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    advisory: vi.fn(),
    review: vi.fn().mockResolvedValue({ advisory: {} }),
    subscriptions: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    subscription: vi.fn(),
    subscriptionStatus: vi.fn().mockResolvedValue({ subscriber: {} }),
    audit: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  };
  const guard: NonNullable<Parameters<typeof createIntelAdminRoutes>[0]>['guard'] = async (
    request,
    reply,
  ) => {
    if (!allowed) return reply.code(403).send({ error: 'Wisesama administrator access required.' });
    request.user = {
      id: 'operator',
      email: 'operator@example.invalid',
      role: 'USER',
      tier: 'free',
      remainingQuota: 100,
    };
  };
  await app.register(
    createIntelAdminRoutes({
      service,
      guard,
      jsonGuard: createAdminJsonGuard({
        NODE_ENV: 'production',
        INTEL_APP_URL: 'https://wisesama.example',
      }),
    }),
    { prefix: '/api/v1' },
  );
  return { app, service };
}
const base = '/api/v1/intel/admin';
const headers = { origin: 'https://wisesama.example' };
describe('operator HTTP contracts', () => {
  it('denies every admin family before querying data or performing a mutation', async () => {
    const { app, service } = await setup(false);
    for (const path of [
      '/session',
      '/overview',
      '/users',
      '/users/target',
      '/advisories',
      '/advisories/GHSA-test',
      '/subscriptions',
      '/subscriptions/subscriber-1',
      '/audit',
    ])
      expect((await app.inject({ url: `${base}${path}` })).statusCode).toBe(403);
    for (const path of [
      '/users/target/access',
      '/advisories/GHSA-test/review',
      '/subscriptions/subscriber-1/status',
    ])
      expect(
        (await app.inject({ method: 'PATCH', url: `${base}${path}`, payload: {}, headers }))
          .statusCode,
      ).toBe(403);
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });
  it('sends no-store responses and dedicated privilege information', async () => {
    const { app } = await setup();
    const result = await app.inject({ url: `${base}/session` });
    expect(result.json()).toEqual({
      user: { id: 'operator', email: 'operator@example.invalid', name: null },
      access: 'intel_admin',
    });
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(result.headers.vary).toBe('Cookie, Origin');
  });
  it('requires configured Origin and JSON for admin writes', async () => {
    const { app, service } = await setup();
    const payload = { suspended: true, expectedRevision: 0, reason: 'Support investigation' };
    expect(
      (await app.inject({ method: 'PATCH', url: `${base}/users/target/access`, payload }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `${base}/users/target/access`,
          payload,
          headers: { origin: 'http://localhost:3002' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `${base}/users/target/access`,
          payload: JSON.stringify(payload),
          headers: { ...headers, 'content-type': 'text/plain' },
        })
      ).statusCode,
    ).toBe(415);
    expect(service.access).not.toHaveBeenCalled();
  });
  it('rejects privilege fields, activation, invalid states and underspecified audit reasons', async () => {
    const { app, service } = await setup();
    for (const payload of [
      { suspended: true, expectedRevision: 0, reason: 'short' },
      { suspended: true, expectedRevision: 0, reason: 'Support investigation', intelAdmin: true },
    ])
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `${base}/users/target/access`,
            payload,
            headers,
          })
        ).statusCode,
      ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `${base}/subscriptions/subscriber-1/status`,
          payload: { status: 'active', expectedRevision: 0, reason: 'Try to bypass consent' },
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `${base}/advisories/GHSA-test/review`,
          payload: {
            visibility: 'published',
            expectedRevision: 0,
            guidance: '',
            note: '',
            reason: 'Source review completed',
            data: { severity: 'low' },
          },
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(service.access).not.toHaveBeenCalled();
    expect(service.subscriptionStatus).not.toHaveBeenCalled();
    expect(service.review).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor and handles stale revisions without a generic server error', async () => {
    const { app, service } = await setup();
    const payload = { suspended: true, expectedRevision: 2, reason: 'Support investigation' };
    service.access.mockRejectedValue(new IntelAdminError(409, 'Record changed. Reload it.'));
    const result = await app.inject({
      method: 'PATCH',
      url: `${base}/users/target/access`,
      payload,
      headers,
    });
    expect(result.statusCode).toBe(409);
    expect(service.access).toHaveBeenCalledWith('operator', 'target', payload);
    expect(result.json().error).toContain('Reload');
  });
  it('validates filter/cursor bounds rather than accepting arbitrary list queries', async () => {
    const { app, service } = await setup();
    expect((await app.inject({ url: `${base}/users?limit=1000` })).statusCode).toBe(400);
    expect((await app.inject({ url: `${base}/subscriptions?status=confirmed` })).statusCode).toBe(
      400,
    );
    expect((await app.inject({ url: `${base}/users?token=secret` })).statusCode).toBe(400);
    expect(service.users).not.toHaveBeenCalled();
  });
});
