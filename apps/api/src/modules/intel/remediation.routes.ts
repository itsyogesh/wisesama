import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateIntel } from '../../middleware/intel-access.middleware';
import { IntelWorkspaceError } from '../../services/intel-workspace.service';
import { OrganizationError } from '../../services/organization-access';
import { remediationInput, remediationService } from '../../services/remediation.service';
import { RepositoryError } from '../../services/repository-provider';

export function createRemediationRoutes(
  options: { service?: typeof remediationService; authenticate?: typeof authenticateIntel } = {},
) {
  const service = options.service ?? remediationService;
  const authenticate = options.authenticate ?? authenticateIntel;
  return async function routes(app: FastifyInstance) {
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof z.ZodError)
        return reply
          .code(400)
          .send({ error: error.issues[0]?.message ?? 'Check the evidence fields.' });
      if (
        error instanceof IntelWorkspaceError ||
        error instanceof OrganizationError ||
        error instanceof RepositoryError
      )
        return reply.code(error.statusCode).send({ error: error.message });
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 400)
        return reply.code(400).send({ error: 'Check the request format and try again.' });
      request.log.error(
        { name: error instanceof Error ? error.name : 'UnknownError' },
        'Remediation request failed',
      );
      return reply
        .code(500)
        .send({ error: 'The remediation request could not complete. Try again.' });
    });
    app.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });
    const base = '/intel/findings/:id/remediation';
    const params = z.object({ id: z.string().regex(/^[a-zA-Z0-9._-]{1,150}$/) });
    app.get(base, { preHandler: authenticate }, (request) =>
      service.get(request.user!.id, params.parse(request.params).id),
    );
    app.patch(base, { preHandler: authenticate }, (request) =>
      service.save(
        request.user!.id,
        params.parse(request.params).id,
        remediationInput.parse(request.body),
      ),
    );
    app.post(`${base}/handoff`, { preHandler: authenticate }, (request) => {
      z.object({}).strict().parse(request.body);
      return service.handoff(request.user!.id, params.parse(request.params).id);
    });
    app.post(`${base}/recheck`, { preHandler: authenticate }, (request) => {
      const body = z
        .object({ revision: z.number().int().min(0) })
        .strict()
        .parse(request.body);
      return service.recheck(request.user!.id, params.parse(request.params).id, body.revision);
    });
    app.get(`${base}/evidence`, { preHandler: authenticate }, async (request, reply) => {
      const id = params.parse(request.params).id;
      reply.header('Content-Disposition', `attachment; filename="wisesama-${id}-evidence.json"`);
      reply.header('X-Content-Type-Options', 'nosniff');
      return service.get(request.user!.id, id);
    });
  };
}
export const remediationRoutes = createRemediationRoutes();
