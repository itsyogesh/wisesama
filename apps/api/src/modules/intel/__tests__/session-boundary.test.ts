import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../../../lib/auth', () => ({ auth: { api: { getSession } } }));
vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../../services/email.service', () => ({ sendApiKeyAlert: vi.fn() }));

import { authenticate } from '../../../middleware/auth.middleware';

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.resetAllMocks();
});
describe('real session middleware with asynchronous response wrapping', () => {
  it.each([
    'missing',
    'failed',
  ])('stops a %s session before private handlers and remains usable', async (mode) => {
    if (mode === 'missing') getSession.mockResolvedValue(null);
    else getSession.mockRejectedValue(new Error('Session unavailable'));
    const app = Fastify();
    apps.push(app);
    const privateHandler = vi.fn(() => ({ private: true }));
    app.addHook('onSend', async (_request, _reply, payload) => {
      await Promise.resolve();
      return payload;
    });
    app.get('/private', { preHandler: authenticate }, privateHandler);
    app.get('/health', async () => ({ ok: true }));
    const denied = await app.inject({ method: 'GET', url: '/private' });
    expect(denied.statusCode).toBe(401);
    expect(denied.json()).toHaveProperty('error');
    expect(privateHandler).not.toHaveBeenCalled();
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
  });
});
