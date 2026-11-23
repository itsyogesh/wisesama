import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdminJsonGuard } from '../../../middleware/admin-access';
import { createAdminOpsRoutes } from '../admin-ops.routes';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../../lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup(authenticated = true) {
  const app = Fastify();
  apps.push(app);
  const jobs = {
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    detail: vi.fn(),
    enqueue: vi.fn().mockResolvedValue({ job: { id: 'job-1', status: 'queued' } }),
    retry: vi.fn(),
    run: vi.fn().mockResolvedValue({ job: { id: 'job-1', status: 'failed' } }),
    failures: vi.fn().mockResolvedValue({ items: [], limit: 100 }),
    runPending: vi.fn(),
    recordScheduledStage: vi.fn(),
  };
  const sources = {
    list: vi.fn().mockResolvedValue({ items: [] }),
    update: vi.fn(),
    assertEnabled: vi.fn(),
    markAttempt: vi.fn(),
    recordResult: vi.fn(),
  };
  const authenticate: typeof import('../../../middleware/admin-access').requireIntelAdmin = async (
    request,
    reply,
  ) => {
    if (!authenticated) return reply.code(403).send({ error: 'Operator access required.' });
    request.user = {
      id: 'operator',
      email: 'synthetic@example.invalid',
      role: 'USER',
      tier: 'free',
      remainingQuota: 100,
    };
  };
  await app.register(
    createAdminOpsRoutes({
      jobs,
      sources,
      authenticate,
      jsonGuard: createAdminJsonGuard({ NODE_ENV: 'test' }),
    }),
    { prefix: '/api/v1' },
  );
  return { app, jobs, sources };
}
const headers = { origin: 'http://localhost:3003' };
const payload = {
  kind: 'source_refresh',
  targetId: 'osv',
  reason: 'Investigate the source and check recovery',
};
describe('operator source/job HTTP boundaries', () => {
  it('protects every route before reaching queries or operations', async () => {
    const { app, jobs, sources } = await setup(false);
    for (const url of ['/sources', '/jobs', '/jobs/job-1', '/failures'])
      expect((await app.inject({ url: `/api/v1/intel/admin${url}` })).statusCode).toBe(403);
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/intel/admin/jobs', payload, headers }))
        .statusCode,
    ).toBe(403);
    expect(jobs.list).not.toHaveBeenCalled();
    expect(jobs.enqueue).not.toHaveBeenCalled();
    expect(sources.list).not.toHaveBeenCalled();
  });
  it('rejects absent/foreign origins and non-JSON mutations', async () => {
    const { app, jobs } = await setup();
    const url = '/api/v1/intel/admin/jobs';
    expect((await app.inject({ method: 'POST', url, payload })).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload,
          headers: { origin: 'https://foreign.invalid' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: '{}',
          headers: { ...headers, 'content-type': 'text/plain' },
        })
      ).statusCode,
    ).toBe(415);
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });
  it('validates reason, source revision, exact target and immutable actor', async () => {
    const { app, jobs, sources } = await setup();
    const url = '/api/v1/intel/admin/jobs';
    expect(
      (await app.inject({ method: 'POST', url, payload: { ...payload, reason: 'short' }, headers }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: { ...payload, targetId: 'https://internal.invalid' },
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: { ...payload, actorId: 'victim' },
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: '/api/v1/intel/admin/sources/osv',
          payload: { paused: true, reason: payload.reason },
          headers,
        })
      ).statusCode,
    ).toBe(400);
    expect(jobs.enqueue).not.toHaveBeenCalled();
    expect(sources.update).not.toHaveBeenCalled();
  });
  it('returns queued work separately from actual execution outcome and disables cache', async () => {
    const { app, jobs } = await setup();
    const queued = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/admin/jobs',
      payload,
      headers,
    });
    expect(queued.statusCode).toBe(200);
    expect(queued.json().job.status).toBe('queued');
    expect(queued.headers['cache-control']).toBe('private, no-store');
    expect(jobs.enqueue).toHaveBeenCalledWith('operator', payload);
    const ran = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/admin/jobs/job-1/run',
      payload: {},
      headers,
    });
    expect(ran.statusCode).toBe(200);
    expect(ran.json().job.status).toBe('failed');
    expect(jobs.run).toHaveBeenCalledWith('job-1', 'operator');
  });
});
