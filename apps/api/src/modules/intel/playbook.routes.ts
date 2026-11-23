import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateIntel as authenticate } from '../../middleware/intel-access.middleware';
import { getResponsePlaybook, responsePlaybooks } from '../../services/intel/playbooks';
import { OrganizationError } from '../../services/organization-access';
import { PlaybookError, playbookService } from '../../services/playbook.service';

const identifier = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9._-]+$/);
const params = z.object({ id: identifier, playbookId: identifier });
const update = z
  .object({
    expectedRevision: z.number().int().min(0).max(2_147_483_646),
    status: z.enum(['investigating', 'contained', 'recovering', 'closed', 'not_affected']),
    answers: z.record(z.enum(['yes', 'no', 'unknown'])),
    checks: z.record(z.boolean()),
    note: z.string().max(4000),
    evidence: z.string().max(4000),
  })
  .strict();
async function requireJson(request: FastifyRequest, reply: FastifyReply) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json'))
    return reply.code(415).send({ error: 'Use application/json for this request.' });
}

export function createPlaybookRoutes(
  options: { service?: typeof playbookService; authenticate?: typeof authenticate } = {},
) {
  const service = options.service ?? playbookService;
  const sessionAuth = options.authenticate ?? authenticate;
  return async function registerPlaybookRoutes(app: FastifyInstance) {
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof OrganizationError)
        return reply.code(error.statusCode).send({ error: error.message });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: 'Check the response fields.' });
      if (error instanceof PlaybookError)
        return reply.code(error.statusCode).send({ error: error.message });
      const statusCode =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Response playbook request failed',
      );
      return reply
        .code(statusCode >= 400 && statusCode < 500 ? statusCode : 500)
        .send({ error: 'The response could not be saved. Try again.' });
    });
    app.get('/intel/playbooks', async (_request, reply) => {
      reply.header('Cache-Control', 'public, max-age=300');
      return { playbooks: responsePlaybooks };
    });
    app.get('/intel/playbooks/:playbookId', async (request, reply) => {
      const { playbookId } = z.object({ playbookId: identifier }).parse(request.params);
      const playbook = getResponsePlaybook(playbookId);
      if (!playbook) throw new PlaybookError(404, 'Response playbook not found.');
      reply.header('Cache-Control', 'public, max-age=300');
      return { playbook };
    });
    app.get(
      '/intel/projects/:id/responses',
      { preHandler: [sessionAuth] },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const { id } = z.object({ id: identifier }).parse(request.params);
        return service.list(request.user!.id, id);
      },
    );
    app.get(
      '/intel/projects/:id/responses/:playbookId',
      { preHandler: [sessionAuth] },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const { id, playbookId } = params.parse(request.params);
        return service.get(request.user!.id, id, playbookId);
      },
    );
    app.post(
      '/intel/projects/:id/responses/:playbookId',
      { preHandler: [sessionAuth, requireJson] },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const { id, playbookId } = params.parse(request.params);
        z.object({}).strict().parse(request.body);
        return service.start(request.user!.id, id, playbookId);
      },
    );
    app.patch(
      '/intel/projects/:id/responses/:playbookId',
      { preHandler: [sessionAuth, requireJson] },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const { id, playbookId } = params.parse(request.params);
        return service.update(request.user!.id, id, playbookId, update.parse(request.body));
      },
    );
  };
}
export const playbookRoutes = createPlaybookRoutes();
