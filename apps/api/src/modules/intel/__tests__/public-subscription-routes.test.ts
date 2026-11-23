import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicSubscriptionService } from '../../../services/public-subscription.service';
import { createPublicSubscriptionRoutes } from '../public-subscription.routes';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
async function setup() {
  const app = Fastify();
  apps.push(app);
  const service = {
    capabilities: vi
      .fn()
      .mockReturnValue({ emailAvailable: true, cadence: 'daily', sendHourUtc: 9 }),
    request: vi.fn().mockResolvedValue({ accepted: true }),
    confirm: vi.fn().mockResolvedValue({ status: 'active' }),
    readPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    unsubscribe: vi.fn().mockResolvedValue({ status: 'unsubscribed' }),
    handleWebhook: vi.fn(),
  };
  await app.register(
    createPublicSubscriptionRoutes(service as unknown as PublicSubscriptionService),
    { prefix: '/api/v1' },
  );
  return { app, service };
}
const TOKEN = 'test-only-capability-12345678901234567890';
describe('public email subscription route boundaries', () => {
  it('allows an email request without an account while validating the consent topics', async () => {
    const { app, service } = await setup();
    const good = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/subscriptions/request',
      payload: { email: 'person@example.test', topics: ['npm'] },
    });
    expect(good.statusCode).toBe(202);
    expect(good.headers['cache-control']).toBe('private, no-store');
    expect(service.request).toHaveBeenCalledWith('person@example.test', ['npm']);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/subscriptions/request',
      payload: { email: 'person@example.test', topics: ['private-projects'] },
    });
    expect(bad.statusCode).toBe(400);
  });
  it('never confirms or unsubscribes on a scanner GET and requires an explicit JSON action', async () => {
    const { app, service } = await setup();
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/v1/intel/subscriptions/confirm?token=${TOKEN}`,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: 'GET', url: `/api/v1/intel/subscriptions/one-click/${TOKEN}` }))
        .statusCode,
    ).toBe(405);
    expect(service.confirm).not.toHaveBeenCalled();
    expect(service.unsubscribe).not.toHaveBeenCalled();
    const confirm = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/subscriptions/confirm',
      payload: { token: TOKEN },
    });
    expect(confirm.statusCode).toBe(200);
    expect(service.confirm).toHaveBeenCalledWith(TOKEN);
    const form = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/subscriptions/confirm',
      headers: { 'content-type': 'text/plain' },
      payload: TOKEN,
    });
    expect(form.statusCode).toBe(415);
  });
  it('accepts only an RFC8058 one-click POST to the unsubscribe-only capability', async () => {
    const { app, service } = await setup();
    const malformed = await app.inject({
      method: 'POST',
      url: `/api/v1/intel/subscriptions/one-click/${TOKEN}`,
      payload: {},
    });
    expect(malformed.statusCode).toBe(400);
    expect(service.unsubscribe).not.toHaveBeenCalled();
    const valid = await app.inject({
      method: 'POST',
      url: `/api/v1/intel/subscriptions/one-click/${TOKEN}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    });
    expect(valid.statusCode).toBe(200);
    expect(service.unsubscribe).toHaveBeenCalledWith(TOKEN);
  });
});
