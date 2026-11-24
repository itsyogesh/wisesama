import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailLinkLanding } from '../email-link';

const fixture = vi.hoisted(() => ({
  tables: {
    user: [] as Record<string, unknown>[],
    session: [] as Record<string, unknown>[],
    account: [] as Record<string, unknown>[],
    verification: [] as Record<string, unknown>[],
  },
  send: vi.fn(),
}));
vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('better-auth/adapters/prisma', async () => {
  const { memoryAdapter } = await import('better-auth/adapters/memory');
  return { prismaAdapter: () => memoryAdapter(fixture.tables) };
});
vi.mock('../../services/auth-email.service', () => ({ sendAuthenticationEmail: fixture.send }));
const origin = 'https://www.wisesama.com';
const callback = `${origin}/app/settings/integrations?next=%2Fapp%2Fprojects%2Fnew`;
beforeEach(() => {
  for (const rows of Object.values(fixture.tables)) rows.length = 0;
  fixture.send.mockReset().mockResolvedValue(undefined);
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-auth-secret-at-least-thirty-two-characters');
  vi.stubEnv('BETTER_AUTH_URL', 'https://api.wisesama.com');
  vi.stubEnv('INTEL_APP_URL', origin);
  vi.stubEnv('RESEND_API_KEY', 'test-provider');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
async function start(body: Record<string, unknown> = {}, requestOrigin = origin) {
  const { auth } = await import('../auth');
  const response = await auth.handler(
    new Request('https://api.wisesama.com/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'member@example.invalid',
        callbackURL: callback,
        errorCallbackURL: `${origin}/sign-in`,
        ...body,
      }),
    }),
  );
  return { auth, response };
}
function redemption(landing: string) {
  const url = new URL('https://api.wisesama.com/api/auth/magic-link/verify');
  url.search = new URL(landing).hash.slice(1);
  return new Request(url);
}
describe('email sign-in and fresh account ownership', () => {
  it('places the bearer in a fragment and does not consume it when preparing the landing page', () => {
    const url = emailLinkLanding(
      'https://api.wisesama.com/api/auth/magic-link/verify?token=secret&callbackURL=%2Fapp%2Finbox',
      origin,
    );
    expect(new URL(url).pathname).toBe('/sign-in/verify');
    expect(new URL(url).search).toBe('');
    expect(new URL(url).hash).toContain('token=secret');
    expect(() =>
      emailLinkLanding('https://api.wisesama.com/api/auth/magic-link/verify', origin),
    ).toThrow();
  });
  it('sends a sign-in email and keeps only a hashed, short-lived token', async () => {
    const { response } = await start();
    expect(response.status).toBe(200);
    expect(fixture.send).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'member@example.invalid', purpose: 'sign-in' }),
    );
    const landing = fixture.send.mock.calls[0]?.[0].url as string;
    const token = new URLSearchParams(new URL(landing).hash.slice(1)).get('token');
    expect(token).toHaveLength(32);
    expect(JSON.stringify(fixture.tables.verification)).not.toContain(token);
    const expires = new Date(fixture.tables.verification[0]?.expiresAt as string).getTime();
    expect(expires - Date.now()).toBeLessThanOrEqual(600_000);
    expect(expires - Date.now()).toBeGreaterThan(590_000);
    expect(fixture.tables.user).toHaveLength(0);
    expect(fixture.tables.session).toHaveLength(0);
  });
  it('creates a verified account only after redemption, then rejects replay', async () => {
    const { auth } = await start({ name: 'Member' });
    const landing = fixture.send.mock.calls[0]?.[0].url as string;
    const request = redemption(landing);
    const response = await auth.handler(request);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(callback);
    expect(response.headers.get('set-cookie')).toContain('session_token=');
    expect(fixture.tables.user).toHaveLength(1);
    expect(fixture.tables.user[0]).toMatchObject({
      email: 'member@example.invalid',
      emailVerified: true,
      name: 'Member',
    });
    const replay = await auth.handler(redemption(landing));
    expect(replay.headers.get('location')).toContain('error=INVALID_TOKEN');
    expect(fixture.tables.session).toHaveLength(1);
  });
  it('uses an existing verified account without changing its linked credentials', async () => {
    const { auth } = await start();
    fixture.tables.user.push({
      id: 'old-user',
      email: 'member@example.invalid',
      name: 'Member',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fixture.tables.account.push({
      id: 'old-account',
      userId: 'old-user',
      accountId: 'old-user',
      providerId: 'credential',
      password: 'unrelated-existing-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const response = await auth.handler(redemption(fixture.send.mock.calls[0]?.[0].url));
    expect(response.status).toBe(302);
    expect(fixture.tables.user).toHaveLength(1);
    expect(fixture.tables.account[0]?.password).toBe('unrelated-existing-hash');
    expect(fixture.tables.session[0]?.userId).toBe('old-user');
  });
  it('rejects expired links and untrusted redirect destinations without a session', async () => {
    const { auth } = await start();
    const landing = fixture.send.mock.calls[0]?.[0].url as string;
    fixture.tables.verification[0]!.expiresAt = new Date(Date.now() - 1000);
    expect((await auth.handler(redemption(landing))).headers.get('location')).toContain(
      'error=INVALID_TOKEN',
    );
    expect(fixture.tables.session).toHaveLength(0);
    await start();
    const request = redemption(fixture.send.mock.calls.at(-1)?.[0].url);
    const malicious = new URL(request.url);
    malicious.searchParams.set('callbackURL', 'https://attacker.example');
    const rejected = await auth.handler(new Request(malicious));
    expect(rejected.headers.get('location') || '').not.toContain('attacker.example');
    expect(rejected.status).toBeGreaterThanOrEqual(300);
    expect(fixture.tables.session).toHaveLength(0);
  });
  it('rejects cross-site email requests and does not send on failure', async () => {
    const { response } = await start({}, 'https://attacker.example');
    expect(response.status).toBe(403);
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('does not issue sessions when sending fails', async () => {
    fixture.send.mockRejectedValueOnce(new Error('Delivery unavailable'));
    expect((await start()).response.status).toBe(500);
    expect(fixture.tables.user).toHaveLength(0);
    expect(fixture.tables.session).toHaveLength(0);
  });
});
