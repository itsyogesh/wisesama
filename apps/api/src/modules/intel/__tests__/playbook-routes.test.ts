import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlaybookRoutes } from '../playbook.routes';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../../middleware/auth.middleware', () => ({
  authenticate: vi.fn(),
  authenticateApiKey: vi.fn(),
}));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup(signedIn = true) {
  const app = Fastify();
  apps.push(app);
  const service = {
    get: vi.fn().mockResolvedValue({ response: null }),
    list: vi.fn().mockResolvedValue({ responses: [] }),
    start: vi.fn().mockResolvedValue({ response: { id: 'saved' } }),
    update: vi.fn().mockResolvedValue({ response: { id: 'saved' } }),
  };
  const auth: typeof import('../../../middleware/auth.middleware').authenticate = async (
    request,
    reply,
  ) => {
    if (!signedIn) return reply.code(401).send({ error: 'Sign in required.' });
    request.user = {
      id: 'owner',
      email: 'test@example.invalid',
      role: 'USER',
      tier: 'free',
      remainingQuota: 100,
    };
  };
  await app.register(createPlaybookRoutes({ service, authenticate: auth }), { prefix: '/api/v1' });
  return { app, service };
}
const url = '/api/v1/intel/projects/project-1/responses/malicious-dependency';
describe('playbook HTTP contracts', () => {
  it('publishes curated guidance without private state or an account', async () => {
    const { app, service } = await setup(false);
    const result = await app.inject({ url: '/api/v1/intel/playbooks' });
    expect(result.statusCode).toBe(200);
    expect(result.json().playbooks).toHaveLength(2);
    expect(result.headers['cache-control']).toContain('public');
    expect(service.list).not.toHaveBeenCalled();
  });
  it('protects private GET, POST and PATCH before reaching storage', async () => {
    const { app, service } = await setup(false);
    for (const method of ['GET', 'POST', 'PATCH'] as const)
      expect(
        (await app.inject({ method, url, ...(method === 'GET' ? {} : { payload: {} }) }))
          .statusCode,
      ).toBe(401);
    expect(service.get).not.toHaveBeenCalled();
    expect(service.start).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });
  it('GET never starts a response and private evidence is not cacheable', async () => {
    const { app, service } = await setup();
    const result = await app.inject({ url });
    expect(result.statusCode).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(service.get).toHaveBeenCalledWith('owner', 'project-1', 'malicious-dependency');
    expect(service.start).not.toHaveBeenCalled();
  });
  it('rejects non-JSON writes and extra or malformed input', async () => {
    const { app, service } = await setup();
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: '{}',
          headers: { 'content-type': 'text/plain' },
        })
      ).statusCode,
    ).toBe(415);
    expect(
      (await app.inject({ method: 'POST', url, payload: { userId: 'victim' } })).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url,
          payload: {
            expectedRevision: -1,
            status: 'closed',
            answers: {},
            checks: {},
            note: '',
            evidence: '',
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(service.start).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });
  it('does not accept client-supplied ownership for a valid update', async () => {
    const { app, service } = await setup();
    const payload = {
      expectedRevision: 0,
      status: 'investigating',
      answers: {},
      checks: {},
      note: '',
      evidence: '',
    };
    expect((await app.inject({ method: 'PATCH', url, payload })).statusCode).toBe(200);
    expect(service.update).toHaveBeenCalledWith(
      'owner',
      'project-1',
      'malicious-dependency',
      payload,
    );
    expect(
      (await app.inject({ method: 'PATCH', url, payload: { ...payload, userId: 'victim' } }))
        .statusCode,
    ).toBe(400);
  });
});
