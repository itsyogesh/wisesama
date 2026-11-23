import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateIntel as authenticate } from '../../middleware/intel-access.middleware';
import { OrganizationError } from '../../services/organization-access';
import { repositoryService } from '../../services/repository.service';
import { RepositoryError } from '../../services/repository-provider';

const params = z
  .object({
    id: z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-zA-Z0-9._-]+$/),
  })
  .strict();
const tri = z.enum(['yes', 'no', 'unknown']);
const context = z
  .object({
    internetFacing: tri,
    sensitiveData: tri,
    hosting: z
      .string()
      .trim()
      .max(120)
      .refine(
        (value) =>
          !Array.from(value).some(
            (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
          ),
        'Use a single line for hosting.',
      ),
  })
  .strict();
async function requireJson(request: FastifyRequest, reply: FastifyReply) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json'))
    return reply.code(415).send({ error: 'Use application/json for this request.' });
}

export function createSecurityBaselineRoutes(
  options: {
    service?: Pick<typeof repositoryService, 'security' | 'updateContext' | 'checkBaseline'>;
    authenticate?: typeof authenticate;
  } = {},
) {
  const service = options.service ?? repositoryService;
  const auth = options.authenticate ?? authenticate;
  return async function register(fastify: FastifyInstance) {
    fastify.addHook('onSend', async (_request, reply, payload) => {
      reply.header('Cache-Control', 'private, no-store');
      return payload;
    });
    fastify.setErrorHandler((error, request, reply) => {
      if (error instanceof OrganizationError)
        return reply.code(error.statusCode).send({ error: error.message });
      if (error instanceof z.ZodError)
        return reply.code(400).send({
          error: 'Check the project context fields.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      if (error instanceof RepositoryError)
        return reply.code(error.statusCode).send({ error: error.message });
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number' &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      )
        return reply
          .code(error.statusCode)
          .send({ error: 'The security baseline request could not be processed.' });
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Repository security baseline request failed',
      );
      return reply.code(500).send({
        error: 'The configuration check could not complete. Previous evidence is retained.',
      });
    });
    const read = { preHandler: auth, schema: { tags: ['intel'], security: [{ cookieAuth: [] }] } };
    const write = { ...read, preHandler: [requireJson, auth] };
    fastify.get('/intel/projects/:id/security', read, (request) =>
      service.security(request.user!.id, params.parse(request.params).id),
    );
    fastify.patch('/intel/projects/:id/context', write, (request) =>
      service.updateContext(
        request.user!.id,
        params.parse(request.params).id,
        context.parse(request.body),
      ),
    );
    fastify.post('/intel/projects/:id/baseline', write, (request) => {
      z.object({})
        .strict()
        .parse(request.body ?? {});
      return service.checkBaseline(request.user!.id, params.parse(request.params).id);
    });
  };
}

export const securityBaselineRoutes = createSecurityBaselineRoutes();
