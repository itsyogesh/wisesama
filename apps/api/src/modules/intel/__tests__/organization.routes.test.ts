import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizationError } from '../../../services/organization-access';
import { createOrganizationRoutes } from '../organization.routes';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../../../middleware/auth.middleware', () => ({
  authenticate: vi.fn(),
  authenticateApiKey: vi.fn(),
}));
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});
const token = 'synthetic_invitation_token_with_32_bytes_123456';
const root = '/api/v1/intel';
const headers = { origin: 'https://wisesama.example' };
async function setup(signedIn = true) {
  const app = Fastify();
  apps.push(app);
  const service = {
    list: vi.fn().mockResolvedValue({ organizations: [], defaultOrganizationId: null }),
    create: vi.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
    get: vi.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
    rename: vi.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
    invite: vi.fn().mockResolvedValue({
      invitation: {},
      inviteUrl: 'https://wisesama.example/invite',
      delivery: 'share_link',
    }),
    revokeInvitation: vi.fn().mockResolvedValue({ revoked: true }),
    changeMember: vi.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
    removeMember: vi.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
    invitation: vi.fn().mockResolvedValue({
      invitation: { organizationName: 'Example', role: 'member', status: 'pending' },
    }),
    acceptInvitation: vi.fn().mockResolvedValue({ organization: { id: 'org-1' } }),
  };
  const authenticate: typeof import('../../../middleware/intel-access.middleware').authenticateIntel =
    async (request, reply) => {
      if (!signedIn) return reply.code(401).send({ error: 'Sign in required.' });
      request.user = {
        id: 'actor',
        email: 'actor@example.invalid',
        role: 'USER',
        tier: 'free',
        remainingQuota: 100,
      };
    };
  await app.register(
    createOrganizationRoutes({
      service,
      authenticate,
      env: { NODE_ENV: 'production', INTEL_APP_URL: 'https://wisesama.example' },
    }),
    { prefix: '/api/v1' },
  );
  return { app, service };
}
describe('organization HTTP boundary', () => {
  it('requires a session for management, including reads', async () => {
    const { app, service } = await setup(false);
    for (const [method, path] of [
      ['GET', '/organizations'],
      ['GET', '/organizations/org-1'],
      ['POST', '/organizations'],
      ['POST', `/organization-invitations/${token}/accept`],
    ] as const) {
      const result = await app.inject({
        method,
        url: `${root}${path}`,
        headers,
        ...(method === 'GET' ? {} : { payload: {} }),
      });
      expect(result.statusCode).toBe(401);
    }
    expect(service.list).not.toHaveBeenCalled();
    expect(service.create).not.toHaveBeenCalled();
    expect(service.acceptInvitation).not.toHaveBeenCalled();
  });
  it('refuses API-key membership management even if a cookie is present', async () => {
    const { app, service } = await setup();
    const result = await app.inject({
      url: `${root}/organizations`,
      headers: { 'x-api-key': 'workspace-key', cookie: 'session=fake' },
    });
    expect(result.statusCode).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
  });
  it('allows a non-consuming public invite preview with no-store and no-referrer', async () => {
    const { app, service } = await setup(false);
    const result = await app.inject({ url: `${root}/organization-invitations/${token}` });
    expect(result.statusCode).toBe(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.headers['referrer-policy']).toBe('no-referrer');
    expect(service.invitation).toHaveBeenCalledWith(token);
    expect(service.acceptInvitation).not.toHaveBeenCalled();
  });
  it('requires JSON and an approved exact origin on every membership write', async () => {
    const { app, service } = await setup();
    const url = `${root}/organization-invitations/${token}/accept`;
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
    for (const origin of [
      undefined,
      'https://wisesama.example.attacker.invalid',
      'null',
      'http://localhost:3003',
    ]) {
      expect(
        (await app.inject({ method: 'POST', url, payload: {}, headers: origin ? { origin } : {} }))
          .statusCode,
      ).toBe(403);
    }
    expect(service.acceptInvitation).not.toHaveBeenCalled();
  });
  it('does not accept client identity, ownership, invitation owner roles or invalid revisions', async () => {
    const { app, service } = await setup();
    const requests = [
      {
        method: 'POST' as const,
        url: `${root}/organizations`,
        payload: { name: 'Example', userId: 'victim' },
      },
      {
        method: 'POST' as const,
        url: `${root}/organizations/org-1/invitations`,
        payload: { email: 'invitee@example.invalid', role: 'owner' },
      },
      {
        method: 'PATCH' as const,
        url: `${root}/organizations/org-1/members/member-1`,
        payload: { role: 'admin', expectedRevision: -1 },
      },
      {
        method: 'POST' as const,
        url: `${root}/organization-invitations/${token}/accept`,
        payload: { email: 'invitee@example.invalid' },
      },
      {
        method: 'POST' as const,
        url: `${root}/organizations/org-1/invitations/invite-1/revoke`,
        payload: { expectedRevision: 2, reason: 'tiny' },
      },
    ];
    for (const request of requests)
      expect((await app.inject({ ...request, headers })).statusCode).toBe(400);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.invite).not.toHaveBeenCalled();
    expect(service.changeMember).not.toHaveBeenCalled();
    expect(service.acceptInvitation).not.toHaveBeenCalled();
  });
  it('takes actor identity from the session and scopes every target through route parameters', async () => {
    const { app, service } = await setup();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${root}/organizations`,
          headers,
          payload: { name: '  My team  ' },
        })
      ).statusCode,
    ).toBe(201);
    expect(service.create).toHaveBeenCalledWith('actor', { name: 'My team' });
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `${root}/organizations/org-1/members/member-1`,
          headers,
          payload: { role: 'admin', expectedRevision: 3 },
        })
      ).statusCode,
    ).toBe(200);
    expect(service.changeMember).toHaveBeenCalledWith('actor', 'org-1', 'member-1', {
      role: 'admin',
      expectedRevision: 3,
    });
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `${root}/organizations/org-1/members/member-1`,
          headers,
          payload: { expectedRevision: 3 },
        })
      ).statusCode,
    ).toBe(200);
    expect(service.removeMember).toHaveBeenCalledWith('actor', 'org-1', 'member-1', {
      expectedRevision: 3,
    });
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `${root}/organization-invitations/${token}/accept`,
          headers,
          payload: {},
        })
      ).statusCode,
    ).toBe(200);
    expect(service.acceptInvitation).toHaveBeenCalledWith('actor', token);
  });
  it('preserves actionable conflicts and access failures without exposing internal failures', async () => {
    const { app, service } = await setup();
    service.get.mockRejectedValueOnce(new OrganizationError(404, 'Organization not found.'));
    expect((await app.inject({ url: `${root}/organizations/org-1` })).statusCode).toBe(404);
    service.acceptInvitation.mockRejectedValueOnce(
      new OrganizationError(403, 'Verify your account email before accepting this invitation.'),
    );
    const response = await app.inject({
      method: 'POST',
      url: `${root}/organization-invitations/${token}/accept`,
      headers,
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toContain('Verify');
    service.get.mockRejectedValueOnce(new Error('SECRET_DATABASE_ERROR'));
    const failed = await app.inject({ url: `${root}/organizations/org-1` });
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain('SECRET_DATABASE_ERROR');
  });
});
