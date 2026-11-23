import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wisesama/database', () => ({
  prisma: {
    verification: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    user: { findFirst: vi.fn(), update: vi.fn() },
    session: {
      findFirst: vi.fn(),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('GitHub sign-in authorization', () => {
  it('requests identity scopes only and preserves the onboarding callback', async () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'wisesama-test-only-session-secret-for-oauth');
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.wisesama.com\n');
    vi.stubEnv('INTEL_APP_URL', 'https://www.wisesama.com');
    vi.stubEnv('GITHUB_CLIENT_ID', 'sign-in-client');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'test-oauth-secret');
    vi.stubEnv('GITHUB_APP_CLIENT_ID', 'repository-client');
    const { auth, githubSignInAvailable } = await import('../auth');
    const callback = 'https://www.wisesama.com/app/projects/new?provider=github';
    const errorCallback = 'https://www.wisesama.com/sign-in?next=%2Fapp%2Fprojects%2Fnew';
    const begin = (scopes?: string[]) =>
      auth.handler(
        new Request('https://api.wisesama.com/api/auth/sign-in/social', {
          method: 'POST',
          headers: { Origin: 'https://www.wisesama.com', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'github',
            callbackURL: callback,
            errorCallbackURL: errorCallback,
            disableRedirect: true,
            scopes,
          }),
        }),
      );
    expect(githubSignInAvailable).toBe(true);
    expect((await begin(['repo'])).status).toBe(400);
    const response = await begin();
    expect(response.status).toBe(200);
    const { url } = (await response.json()) as { url: string };
    const authorization = new URL(url);
    expect(authorization.origin).toBe('https://github.com');
    expect(authorization.searchParams.get('client_id')).toBe('sign-in-client');
    expect(authorization.searchParams.get('redirect_uri')).toBe(
      'https://api.wisesama.com/api/auth/callback/github',
    );
    expect(authorization.searchParams.get('scope')?.split(/\s+/).sort()).toEqual([
      'read:user',
      'user:email',
    ]);
    expect(authorization.searchParams.get('state')).toBeTruthy();
    expect(response.headers.get('set-cookie')).toMatch(/(?:^|; )Max-Age=600(?:;|$)/i);
    expect(auth.options.onAPIError?.errorURL).toBe('https://www.wisesama.com/sign-in');
    const { prisma } = await import('@wisesama/database');
    expect(prisma.verification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: expect.stringContaining(callback) }),
      }),
    );
    const saved = vi.mocked(prisma.verification.create).mock.calls.at(-1)?.[0].data;
    vi.mocked(prisma.verification.findMany).mockResolvedValue([
      saved as Awaited<ReturnType<typeof prisma.verification.findMany>>[number],
    ]);
    const redirect = new URL('https://api.wisesama.com/api/auth/callback/github');
    redirect.searchParams.set('state', authorization.searchParams.get('state')!);
    redirect.searchParams.set('error', 'access_denied');
    const withoutCookie = await auth.handler(new Request(redirect));
    expect(withoutCookie.headers.get('location')).toBe(`${errorCallback}&error=state_mismatch`);
    const [cookie = ''] = response.headers.get('set-cookie')!.split(';', 1);
    const withCookie = await auth.handler(new Request(redirect, { headers: { Cookie: cookie } }));
    expect(withCookie.headers.get('location')).toBe(`${errorCallback}&error=access_denied`);
  }, 60_000);

  it.each([
    { mode: 'sign-in', localVerified: true, githubVerified: true, links: true },
    { mode: 'sign-in', localVerified: false, githubVerified: true, links: false },
    { mode: 'sign-in', localVerified: true, githubVerified: false, links: false },
    { mode: 'link', localVerified: true, githubVerified: true, links: true },
    { mode: 'link', localVerified: true, githubVerified: false, links: false },
    { mode: 'link', localVerified: true, githubVerified: true, links: false, conflict: true },
  ])('handles GitHub sign-in and explicit linking (%o)', async (scenario) => {
    const secret = 'wisesama-test-only-session-secret-for-oauth';
    vi.stubEnv('BETTER_AUTH_SECRET', secret);
    vi.stubEnv('BETTER_AUTH_URL', 'https://api.wisesama.com');
    vi.stubEnv('GITHUB_CLIENT_ID', 'sign-in-client');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'test-oauth-secret');
    const { auth } = await import('../auth');
    const { prisma } = await import('@wisesama/database');
    const email = 'member@example.com';
    const explicitLink = scenario.mode === 'link';
    const user = {
      id: 'existing-user',
      email: explicitLink ? 'member@workspace.example' : email,
      emailVerified: scenario.localVerified,
      name: 'Member',
      image: null,
      role: 'USER' as const,
      tier: 'free',
      remainingQuota: 100,
      isVerified: false,
      intelAdmin: false,
      intelSuspendedAt: null,
      intelSuspensionReason: '',
      intelRevision: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      account: [],
    };
    vi.mocked(prisma.account.findMany).mockResolvedValue(
      scenario.conflict
        ? [{ providerId: 'github', accountId: '100', userId: 'another-user' } as never]
        : [],
    );
    vi.mocked(prisma.user.findFirst).mockResolvedValue(user);
    const token = 'mock-signed-in-session';
    const signedToken = `${token}.${createHmac('sha256', secret).update(token).digest('base64')}`;
    const sessionCookie = `__Secure-better-auth.session_token=${encodeURIComponent(signedToken)}`;
    vi.mocked(prisma.session.findFirst).mockResolvedValue({
      id: 'session',
      token,
      userId: user.id,
      user,
      expiresAt: new Date(Date.now() + 7 * 86400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    } as Awaited<ReturnType<typeof prisma.session.findFirst>>);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        switch (url.href) {
          case 'https://github.com/login/oauth/access_token':
            return Response.json({ access_token: 'mock-github-token', token_type: 'bearer' });
          case 'https://api.github.com/user':
            return Response.json({ id: 100, login: 'member', email });
          case 'https://api.github.com/user/emails':
            return Response.json([{ email, primary: true, verified: scenario.githubVerified }]);
          default:
            throw new Error(`Unexpected request to ${url.origin}${url.pathname}`);
        }
      }),
    );
    const callbackURL = 'https://www.wisesama.com/app/projects/new?provider=github&connect=github';
    const errorCallbackURL = 'https://www.wisesama.com/sign-in';
    const start = await auth.handler(
      new Request(
        `https://api.wisesama.com/api/auth/${explicitLink ? 'link-social' : 'sign-in/social'}`,
        {
          method: 'POST',
          headers: {
            Origin: 'https://www.wisesama.com',
            'Content-Type': 'application/json',
            ...(explicitLink ? { Cookie: sessionCookie } : {}),
          },
          body: JSON.stringify({
            provider: 'github',
            callbackURL,
            errorCallbackURL,
            disableRedirect: true,
          }),
        },
      ),
    );
    expect(start.status).toBe(200);
    const { url } = (await start.json()) as { url: string };
    const saved = vi.mocked(prisma.verification.create).mock.calls.at(-1)?.[0].data;
    vi.mocked(prisma.verification.findMany).mockResolvedValue([
      saved as Awaited<ReturnType<typeof prisma.verification.findMany>>[number],
    ]);
    const callback = new URL('https://api.wisesama.com/api/auth/callback/github');
    callback.searchParams.set('state', new URL(url).searchParams.get('state')!);
    callback.searchParams.set('code', 'mock-github-code');
    const [cookie = ''] = start.headers.get('set-cookie')!.split(';', 1);
    const response = await auth.handler(
      new Request(callback, {
        headers: { Cookie: explicitLink ? `${cookie}; ${sessionCookie}` : cookie },
      }),
    );
    const expectedError = scenario.conflict
      ? 'account_already_linked_to_different_user'
      : explicitLink
        ? 'unable_to_link_account'
        : 'account_not_linked';
    expect(response.headers.get('location')).toBe(
      scenario.links ? callbackURL : `${errorCallbackURL}?error=${expectedError}`,
    );
    if (scenario.links) {
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerId: 'github',
            accountId: '100',
            userId: user.id,
          }),
        }),
      );
      if (explicitLink) {
        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.session.create).not.toHaveBeenCalled();
      } else {
        expect(response.headers.get('set-cookie')).toContain('session_token=');
      }
    } else {
      expect(prisma.account.create).not.toHaveBeenCalled();
      expect(prisma.session.create).not.toHaveBeenCalled();
    }
  });
});
