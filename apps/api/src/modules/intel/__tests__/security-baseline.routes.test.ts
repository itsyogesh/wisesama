import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryError } from '../../../services/repository-provider';
import { createSecurityBaselineRoutes } from '../security-baseline.routes';

async function fixture(authenticated = true) {
  const service = {
    security: vi.fn().mockResolvedValue({ baseline: { status: 'unsupported' } }),
    updateContext: vi.fn().mockResolvedValue({}),
    checkBaseline: vi.fn().mockResolvedValue({}),
  };
  const app = Fastify();
  await app.register(
    createSecurityBaselineRoutes({
      service,
      authenticate: async (request, reply) => {
        if (!authenticated) return reply.code(401).send({ error: 'Sign in required.' });
        request.user = {
          id: 'alice',
          email: 'alice@example.invalid',
          role: 'USER',
          tier: 'free',
          remainingQuota: 100,
        };
      },
    }),
  );
  return { app, service };
}
describe('security context and baseline route boundaries', () => {
  it('rejects unauthenticated reads and writes without calling the service', async () => {
    const { app, service } = await fixture(false);
    try {
      expect(
        (await app.inject({ method: 'GET', url: '/intel/projects/p/security' })).statusCode,
      ).toBe(401);
      expect(
        (await app.inject({ method: 'POST', url: '/intel/projects/p/baseline', payload: {} }))
          .statusCode,
      ).toBe(401);
      expect(service.security).not.toHaveBeenCalled();
      expect(service.checkBaseline).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
  it('passes the session owner and marks potentially sensitive context private', async () => {
    const { app, service } = await fixture();
    try {
      const response = await app.inject({ method: 'GET', url: '/intel/projects/p/security' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(service.security).toHaveBeenCalledWith('alice', 'p');
    } finally {
      await app.close();
    }
  });
  it('rejects form encodings, owner injection and unbounded context values', async () => {
    const { app, service } = await fixture();
    try {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/intel/projects/p/context',
            headers: { 'Content-Type': 'text/plain' },
            payload: '{}',
          })
        ).statusCode,
      ).toBe(415);
      const valid = { internetFacing: 'unknown', sensitiveData: 'yes', hosting: 'Vercel' };
      for (const input of [
        { ...valid, userId: 'bob' },
        { ...valid, hosting: 'a'.repeat(121) },
        { ...valid, internetFacing: true },
        { ...valid, hosting: 'line\nline' },
      ]) {
        expect(
          (await app.inject({ method: 'PATCH', url: '/intel/projects/p/context', payload: input }))
            .statusCode,
        ).toBe(400);
      }
      expect(service.updateContext).not.toHaveBeenCalled();
      expect(
        (await app.inject({ method: 'PATCH', url: '/intel/projects/p/context', payload: valid }))
          .statusCode,
      ).toBe(200);
      expect(service.updateContext).toHaveBeenCalledWith('alice', 'p', valid);
    } finally {
      await app.close();
    }
  });
  it('does not accept client supplied baseline results and returns safe lifecycle errors', async () => {
    const { app, service } = await fixture();
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/intel/projects/p/baseline',
            payload: { checks: [], commit: 'pretend' },
          })
        ).statusCode,
      ).toBe(400);
      expect(service.checkBaseline).not.toHaveBeenCalled();
      service.checkBaseline.mockRejectedValue(
        new RepositoryError(
          409,
          'Connect and sync an active repository source before checking its baseline.',
        ),
      );
      const response = await app.inject({
        method: 'POST',
        url: '/intel/projects/p/baseline',
        payload: {},
      });
      expect(response.statusCode).toBe(409);
      expect(response.body).toContain('active repository');
    } finally {
      await app.close();
    }
  });
});
