import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntelAdvisory } from '../../../services/intel/index';
import { IntelWorkspaceError } from '../../../services/intel-workspace.service';
import { createIntelRoutes } from '../intel.routes';

vi.mock('@wisesama/database', () => ({ prisma: {}, Prisma: { DbNull: null } }));
vi.mock('../../../middleware/auth.middleware', () => ({
  authenticate: vi.fn(),
  authenticateApiKey: vi.fn(),
}));

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup(authenticated = true) {
  const app = Fastify();
  apps.push(app);
  const service = {
    getBriefings: vi.fn().mockResolvedValue({
      advisories: [] as IntelAdvisory[],
      sources: [],
      fetchedAt: '2026-11-04T10:00:00Z',
      stale: false,
    }),
    getBriefing: vi.fn(),
    getWorkspace: vi.fn().mockResolvedValue({ projects: [] }),
    createProject: vi.fn().mockResolvedValue({ project: { id: 'project-1' } }),
    updateInventory: vi.fn(),
    scanProject: vi.fn().mockResolvedValue({ findings: [] }),
    updateFinding: vi.fn(),
    getNotificationSettings: vi.fn(),
    updateNotificationSettings: vi.fn(),
    testNotification: vi.fn(),
    listDeliveries: vi.fn(),
    processDeliveries: vi.fn(),
    runScheduledScans: vi.fn(),
  };
  const auth: NonNullable<Parameters<typeof createIntelRoutes>[0]>['authenticate'] = async (
    request,
    reply,
  ) => {
    if (!authenticated) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }
    request.user = {
      id: 'owner',
      email: 'owner@example.org',
      role: 'USER',
      tier: 'free',
      remainingQuota: 100,
    };
  };
  await app.register(createIntelRoutes({ service, authenticate: auth, authenticateApiKey: auth }), {
    prefix: '/api/v1',
  });
  return { app, service };
}

describe('security workflow API boundaries', () => {
  it('applies the same ecosystem and exploitation filters to JSON and RSS', async () => {
    const { app, service } = await setup(false);
    const shared = {
      aliases: [],
      summary: 'Synthetic test record',
      cvss: null,
      epss: null,
      publishedAt: '2026-11-04T10:00:00Z',
      modifiedAt: '2026-11-04T10:00:00Z',
      references: [],
      source: 'OSV',
    };
    service.getBriefings.mockResolvedValue({
      advisories: [
        {
          ...shared,
          id: 'GHSA-match',
          title: 'Matching npm advisory',
          severity: 'high',
          exploited: true,
          affected: [{ name: 'example', ecosystem: 'npm' }],
        },
        {
          ...shared,
          id: 'GHSA-other',
          title: 'Other Python advisory',
          severity: 'high',
          exploited: true,
          affected: [{ name: 'other', ecosystem: 'PyPI' }],
        },
      ],
      sources: [],
      fetchedAt: '2026-11-04T10:00:00Z',
      stale: false,
    });
    const query = '?ecosystem=npm&severity=high&exploited=true&q=example';
    const json = await app.inject({ method: 'GET', url: `/api/v1/intel/briefings${query}` });
    const rss = await app.inject({ method: 'GET', url: `/api/v1/intel/feed.xml${query}` });
    expect(json.json().advisories.map((item: IntelAdvisory) => item.id)).toEqual(['GHSA-match']);
    expect(rss.body).toContain('GHSA-match');
    expect(rss.body).not.toContain('GHSA-other');
    expect(rss.headers['content-type']).toContain('application/rss+xml');
  });
  it('requires authentication before revealing a workspace', async () => {
    const { app, service } = await setup(false);
    const response = await app.inject({ method: 'GET', url: '/api/v1/intel/workspace' });
    expect(response.statusCode).toBe(401);
    expect(service.getWorkspace).not.toHaveBeenCalled();
  });

  it('rejects cross-site form-style mutations', async () => {
    const { app, service } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/projects/project-1/scan',
      headers: { 'content-type': 'text/plain' },
      payload: '{}',
    });
    expect(response.statusCode).toBe(415);
    expect(service.scanProject).not.toHaveBeenCalled();
  });

  it('derives the owner from authentication and rejects client-supplied owners', async () => {
    const { app, service } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/projects',
      payload: {
        organizationId: 'org-1',
        name: 'Checkout',
        environment: 'production',
        userId: 'victim',
        inventory: {
          format: 'inventory',
          content: '[{"name":"example","version":"1.0.0","ecosystem":"npm"}]',
        },
      },
    });
    expect(response.statusCode).toBe(400);
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('creates a project for the authenticated owner with a validated inventory', async () => {
    const { app, service } = await setup();
    const payload = {
      organizationId: 'org-1',
      name: 'Checkout',
      environment: 'production',
      inventory: { format: 'inventory', content: '[]' },
    };
    const response = await app.inject({ method: 'POST', url: '/api/v1/intel/projects', payload });
    expect(response.statusCode).toBe(201);
    expect(service.createProject).toHaveBeenCalledWith('owner', payload);
  });

  it('requires a target organization when creating projects and forwards workspace scope', async () => {
    const { app, service } = await setup();
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/projects',
      payload: {
        name: 'Checkout',
        environment: 'production',
        inventory: { format: 'inventory', content: '[]' },
      },
    });
    expect(missing.statusCode).toBe(400);
    expect(service.createProject).not.toHaveBeenCalled();
    const scoped = await app.inject({
      method: 'GET',
      url: '/api/v1/intel/workspace?organizationId=org-1',
    });
    expect(scoped.statusCode).toBe(200);
    expect(service.getWorkspace).toHaveBeenCalledWith('owner', 'org-1');
  });

  it('rejects arbitrary email recipients on a notification test', async () => {
    const { app, service } = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/notifications/test',
      payload: { to: 'victim@example.org' },
    });
    expect(response.statusCode).toBe(400);
    expect(service.testNotification).not.toHaveBeenCalled();
  });

  it('rejects invented workflow statuses', async () => {
    const { app, service } = await setup();
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/intel/findings/finding-1',
      payload: { status: 'safe' },
    });
    expect(response.statusCode).toBe(400);
    expect(service.updateFinding).not.toHaveBeenCalled();
  });

  it('returns a safe not-found response for another owner’s project', async () => {
    const { app, service } = await setup();
    service.scanProject.mockRejectedValue(new IntelWorkspaceError(404, 'Project not found.'));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/intel/projects/other-project/scan',
      payload: {},
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Project not found.' });
  });

  it('escapes upstream text in public RSS and excludes workspace data', async () => {
    const { app, service } = await setup(false);
    service.getBriefings.mockResolvedValue({
      advisories: [
        {
          id: 'GHSA-test',
          aliases: [],
          title: '<script>alert("x")</script>',
          summary: 'A & B',
          severity: 'high',
          cvss: null,
          exploited: false,
          epss: null,
          publishedAt: '2026-11-04T10:00:00Z',
          modifiedAt: '2026-11-04T10:00:00Z',
          references: [],
          affected: [],
          source: 'Test',
        },
      ],
      sources: [],
      fetchedAt: '2026-11-04T10:00:00Z',
      stale: false,
    });
    const response = await app.inject({ method: 'GET', url: '/api/v1/intel/feed.xml' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/rss+xml');
    expect(response.body).toContain('&lt;script&gt;');
    expect(response.body).toContain('A &amp; B');
    expect(response.body).not.toContain('<script>');
    expect(service.getWorkspace).not.toHaveBeenCalled();
  });
});
