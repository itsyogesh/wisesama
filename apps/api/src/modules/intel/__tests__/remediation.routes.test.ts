import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../../services/repository.service', () => ({ repositoryService: { sync: vi.fn() } }));

import type { authenticateIntel } from '../../../middleware/intel-access.middleware';
import { IntelWorkspaceError } from '../../../services/intel-workspace.service';
import { createRemediationRoutes } from '../remediation.routes';

async function setup(signedIn = true) {
  const service = {
    get: vi.fn().mockResolvedValue({ findingId: 'finding-1' }),
    save: vi.fn().mockResolvedValue({ revision: 1 }),
    handoff: vi.fn().mockResolvedValue({ prompt: 'context' }),
    recheck: vi.fn().mockResolvedValue({ revision: 2 }),
  };
  const authenticate: typeof authenticateIntel = async (request, reply) => {
    if (!signedIn) return reply.code(401).send({ error: 'Sign in to continue.' });
    request.user = {
      id: 'owner',
      email: 'owner@example.invalid',
      role: 'USER',
      tier: 'FREE',
      remainingQuota: 100,
    } as NonNullable<typeof request.user>;
  };
  const app = Fastify();
  await app.register(createRemediationRoutes({ service: service as never, authenticate }), {
    prefix: '/api/v1',
  });
  await app.ready();
  return { app, service };
}
const base = '/api/v1/intel/findings/finding-1/remediation';
describe('remediation API boundary', () => {
  it('requires a session for private reads, handoffs, evidence and rechecks', async () => {
    const { app, service } = await setup(false);
    for (const [method, url] of [
      ['GET', base],
      ['GET', `${base}/evidence`],
      ['POST', `${base}/handoff`],
      ['POST', `${base}/recheck`],
      ['PATCH', base],
    ] as const) {
      const response = await app.inject({ method, url });
      expect(response.statusCode).toBe(401);
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
    expect(service.get).not.toHaveBeenCalled();
    await app.close();
  });
  it('validates optimistic revisions and rejects supplied verification claims', async () => {
    const { app, service } = await setup();
    for (const payload of [
      { revision: -1 },
      { revision: 0, fields: { verified: true } },
      { revision: 0, fields: {}, recheck: { result: 'clear' } },
    ]) {
      expect((await app.inject({ method: 'PATCH', url: base, payload })).statusCode).toBe(400);
    }
    expect(service.save).not.toHaveBeenCalled();
    await app.close();
  });
  it('exports a private JSON attachment through the same membership-scoped read', async () => {
    const { app, service } = await setup();
    const response = await app.inject({ method: 'GET', url: `${base}/evidence` });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(service.get).toHaveBeenCalledWith('owner', 'finding-1');
    await app.close();
  });
  it('returns conflicts without leaking internal exception details', async () => {
    const { app, service } = await setup();
    service.recheck.mockRejectedValueOnce(
      new IntelWorkspaceError(409, 'Reload the latest record.'),
    );
    const response = await app.inject({
      method: 'POST',
      url: `${base}/recheck`,
      payload: { revision: 0 },
    });
    expect(response.statusCode).toBe(409);
    service.get.mockRejectedValueOnce(new Error('postgres://internal-credentials'));
    const failed = await app.inject({ method: 'GET', url: base });
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain('postgres');
    await app.close();
  });
});
