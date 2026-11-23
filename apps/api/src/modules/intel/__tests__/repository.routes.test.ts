import Fastify from 'fastify';
import rawBody from 'fastify-raw-body';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { repositoryService } from '../../../services/repository.service';
import { RepositoryError } from '../../../services/repository-provider';
import { createRepositoryRoutes } from '../repository.routes';

afterEach(() => vi.unstubAllEnvs());
async function app(authenticated = true) {
  const service = {
    ...repositoryService,
    listConnections: vi.fn().mockResolvedValue({ connections: [], providers: [] }),
    repositories: vi.fn().mockResolvedValue({ repositories: [], incomplete: false }),
    start: vi
      .fn()
      .mockResolvedValue({ authorizationUrl: 'https://github.com/apps/test/installations/new' }),
    preview: vi.fn().mockResolvedValue({ commit: 'a'.repeat(40) }),
    createProject: vi.fn().mockResolvedValue({ project: { id: 'project-1' } }),
    listSources: vi.fn().mockResolvedValue({ sources: [] }),
    callback: vi.fn(),
    webhook: vi.fn().mockResolvedValue({ accepted: true }),
    disconnect: vi.fn().mockResolvedValue({ disconnected: true }),
    sync: vi.fn(),
  };
  const server = Fastify();
  await server.register(rawBody, { field: 'rawBody', global: false, runFirst: true });
  await server.register(
    createRepositoryRoutes({
      service,
      authenticate: async (request, reply) => {
        if (!authenticated) {
          reply.code(401).send({ error: 'Sign in required.' });
          return;
        }
        request.user = {
          id: 'alice',
          email: 'alice@example.test',
          role: 'USER',
          tier: 'free',
          remainingQuota: 100,
        };
      },
    }),
  );
  return { server, service };
}

describe('repository route boundaries', () => {
  it('resumes onboarding with the verified connection and rejects an arbitrary return destination', async () => {
    vi.stubEnv('INTEL_APP_URL', 'https://app.example.test');
    const { server, service } = await app();
    service.callback.mockResolvedValue({ connection: { id: 'authorized-connection' } });
    try {
      const rejected = await server.inject({
        method: 'POST',
        url: '/intel/repositories/github/start',
        payload: { destination: 'https://outside.example' },
      });
      expect(rejected.statusCode).toBe(400);
      expect(service.start).not.toHaveBeenCalled();
      await server.inject({
        method: 'POST',
        url: '/intel/repositories/github/start',
        payload: { destination: 'project' },
      });
      expect(service.start).toHaveBeenCalledWith('alice', 'github', 'project');
      const response = await server.inject({
        url: '/intel/repositories/callback/github?state=project.12345678901234567890&code=fixture',
      });
      expect(response.headers.location).toBe(
        'https://app.example.test/app/projects/new?connection=connected&connectionId=authorized-connection',
      );
      expect(service.callback).toHaveBeenCalledWith(
        'alice',
        'github',
        expect.objectContaining({ code: 'fixture' }),
      );
    } finally {
      await server.close();
    }
  });
  it('bounds repository pages and preserves the session owner', async () => {
    const { server, service } = await app();
    try {
      const base = '/intel/repositories/connections/conn/repositories';
      expect((await server.inject({ url: `${base}?page=11` })).statusCode).toBe(400);
      expect(service.repositories).not.toHaveBeenCalled();
      expect((await server.inject({ url: `${base}?page=2` })).statusCode).toBe(200);
      expect(service.repositories).toHaveBeenCalledWith('alice', 'conn', 2);
    } finally {
      await server.close();
    }
  });
  it('requires a session before showing connection metadata', async () => {
    const { server, service } = await app(false);
    try {
      const response = await server.inject({
        method: 'GET',
        url: '/intel/repositories/connections',
      });
      expect(response.statusCode).toBe(401);
      expect(service.listConnections).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
  it('rejects cross-site form encodings before running a mutation', async () => {
    const { server, service } = await app();
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/intel/repositories/connections/conn/preview',
        headers: { 'Content-Type': 'text/plain' },
        payload: '{}',
      });
      expect(response.statusCode).toBe(415);
      expect(service.preview).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
  it('rejects traversal and unsupported paths at the API edge', async () => {
    const { server, service } = await app();
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/intel/repositories/connections/conn/preview',
        payload: { repositoryId: '42', branch: 'main', paths: ['../package.json'] },
      });
      expect(response.statusCode).toBe(400);
      expect(service.preview).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
  it('passes only the session owner to imports and marks responses private', async () => {
    const { server, service } = await app();
    try {
      const input = { repositoryId: '42', branch: 'main', paths: ['package.json'] };
      const response = await server.inject({
        method: 'POST',
        url: '/intel/repositories/connections/conn/preview',
        payload: input,
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(service.preview).toHaveBeenCalledWith('alice', 'conn', input);
    } finally {
      await server.close();
    }
  });
  it('requires organization selection for onboarding and forwards scoped source requests', async () => {
    const { server, service } = await app();
    try {
      const selection = {
        connectionId: 'conn',
        repositoryId: '42',
        branch: 'main',
        paths: ['package.json'],
        name: 'Service',
        environment: 'development',
      };
      const missing = await server.inject({
        method: 'POST',
        url: '/intel/repositories/projects',
        payload: selection,
      });
      expect(missing.statusCode).toBe(400);
      expect(service.createProject).not.toHaveBeenCalled();
      const payload = { ...selection, organizationId: 'org-1' };
      const created = await server.inject({
        method: 'POST',
        url: '/intel/repositories/projects',
        payload,
      });
      expect(created.statusCode).toBe(201);
      expect(service.createProject).toHaveBeenCalledWith('alice', payload);
      const sources = await server.inject({
        method: 'GET',
        url: '/intel/repositories/sources?organizationId=org-1',
      });
      expect(sources.statusCode).toBe(200);
      expect(service.listSources).toHaveBeenCalledWith('alice', 'org-1');
    } finally {
      await server.close();
    }
  });
  it('returns safe provider errors without exposing upstream response or tokens', async () => {
    const { server, service } = await app();
    service.sync.mockRejectedValue(
      new RepositoryError(409, 'An inventory sync is already running.'),
    );
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/intel/repositories/sources/source/sync',
        payload: {},
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: 'An inventory sync is already running.' });
    } finally {
      await server.close();
    }
  });
  it('preserves exact webhook bytes and supported signature headers for verification', async () => {
    const { server, service } = await app();
    const body = '{ "ref": "refs/heads/main" }';
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/intel/repositories/webhooks/github',
        headers: {
          'Content-Type': 'application/json',
          'x-github-delivery': 'id',
          'x-github-event': 'push',
          'x-hub-signature-256': 'signature',
        },
        payload: body,
      });
      expect(response.statusCode).toBe(202);
      expect(service.webhook).toHaveBeenCalledWith(
        'github',
        body,
        expect.objectContaining({ 'x-hub-signature-256': 'signature', 'x-github-delivery': 'id' }),
      );
    } finally {
      await server.close();
    }
  });
  it('does not render authorization codes or state into failure pages', async () => {
    vi.stubEnv('INTEL_APP_URL', 'https://app.example.test');
    const { server, service } = await app();
    service.callback.mockRejectedValue(new Error('secret-code'));
    try {
      const response = await server.inject({
        method: 'GET',
        url: '/intel/repositories/callback/gitlab?state=long-random-state-123456789&code=secret-code',
      });
      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe(
        'https://app.example.test/app/settings/integrations?connection=failed',
      );
      expect(response.body).not.toContain('secret-code');
    } finally {
      await server.close();
    }
  });
});
