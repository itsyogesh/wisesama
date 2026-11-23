import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateIntel as authenticate } from '../../middleware/intel-access.middleware';
import { InventoryValidationError } from '../../services/intel/types';
import { OrganizationError } from '../../services/organization-access';
import { repositoryService } from '../../services/repository.service';
import {
  MAX_REPOSITORY_PAGES,
  RepositoryError,
  supportedFile,
} from '../../services/repository-provider';

const id = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9._-]+$/);
const repositoryId = z.string().regex(/^[1-9]\d{0,18}$/);
const provider = z.enum(['github', 'gitlab']);
const branch = z
  .string()
  .min(1)
  .max(250)
  .refine(
    (value) =>
      !Array.from(value).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ),
    'Invalid branch.',
  );
const paths = z
  .array(
    z
      .string()
      .min(1)
      .max(600)
      .refine((value) => Boolean(supportedFile(value)), 'Unsupported inventory path.'),
  )
  .min(1)
  .max(10)
  .refine((values) => new Set(values).size === values.length, 'Choose distinct file paths.');
const selection = z.object({ repositoryId, branch, paths }).strict();
async function requireJson(request: FastifyRequest, reply: FastifyReply) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json'))
    reply.code(415).send({ error: 'Use application/json for this request.' });
}
function appUrl(path: string) {
  const origin = process.env.INTEL_APP_URL;
  if (!origin) throw new RepositoryError(503, 'The application callback is not configured.');
  const url = new URL(origin);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new RepositoryError(503, 'The application callback requires HTTPS.');
  return new URL(path, url).toString();
}

export function createRepositoryRoutes(
  options: { service?: typeof repositoryService; authenticate?: typeof authenticate } = {},
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
          error: 'Check the repository selection.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      if (error instanceof RepositoryError || error instanceof InventoryValidationError)
        return reply
          .code(error instanceof RepositoryError ? error.statusCode : 400)
          .send({ error: error.message });
      const statusCode =
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
      if (statusCode >= 400 && statusCode < 500)
        return reply.code(statusCode).send({
          error:
            statusCode === 413
              ? 'The repository request exceeds the size limit.'
              : 'The repository request could not be processed.',
        });
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Repository request failed',
      );
      return reply.code(500).send({ error: 'Repository access could not complete. Try again.' });
    });
    const privateRoute = {
      preHandler: auth,
      schema: { tags: ['repositories'], security: [{ cookieAuth: [] }] },
    };
    const mutation = { ...privateRoute, preHandler: [requireJson, auth] };
    fastify.get('/intel/repositories/connections', privateRoute, (request) =>
      service.listConnections(request.user!.id),
    );
    fastify.post('/intel/repositories/:provider/start', mutation, (request) => {
      const body = z
        .object({ destination: z.literal('project').optional() })
        .strict()
        .parse(request.body ?? {});
      const params = z.object({ provider }).parse(request.params);
      return service.start(request.user!.id, params.provider, body.destination);
    });
    // OAuth codes/state are sensitive. Per-route silent logging prevents automatic URL logs.
    fastify.get(
      '/intel/repositories/callback/:provider',
      { ...privateRoute, logLevel: 'silent' },
      async (request, reply) => {
        const params = z.object({ provider }).parse(request.params);
        const query = z
          .object({
            state: z.string().min(20).max(200),
            code: z.string().min(1).max(1000).optional(),
            installation_id: repositoryId.optional(),
            setup_action: z.string().max(50).optional(),
            error: z.string().max(100).optional(),
            error_description: z.string().max(1000).optional(),
          })
          .parse(request.query);
        const onboarding = query.state.startsWith('project.');
        const destination = onboarding ? '/app/projects/new' : '/app/settings/integrations';
        try {
          if (query.error) return reply.redirect(appUrl(`${destination}?connection=denied`));
          if (params.provider === 'github' && query.setup_action === 'request' && !query.code)
            return reply.redirect(appUrl(`${destination}?connection=requested`));
          const result = await service.callback(request.user!.id, params.provider, {
            state: query.state,
            code: query.code,
            installationId: query.installation_id,
          });
          if ('redirect' in result && result.redirect) return reply.redirect(result.redirect);
          const returnUrl = new URL(appUrl(`${destination}?connection=connected`));
          if (onboarding && result.connection)
            returnUrl.searchParams.set('connectionId', result.connection.id);
          return reply.redirect(returnUrl.toString());
        } catch {
          return reply.redirect(appUrl(`${destination}?connection=failed`));
        }
      },
    );
    fastify.get('/intel/repositories/connections/:id/repositories', privateRoute, (request) => {
      const params = z.object({ id }).parse(request.params);
      const query = z
        .object({
          page: z
            .string()
            .regex(/^[1-9]\d?$/)
            .transform(Number)
            .pipe(z.number().max(MAX_REPOSITORY_PAGES))
            .optional(),
        })
        .parse(request.query);
      return service.repositories(request.user!.id, params.id, query.page);
    });
    fastify.get('/intel/repositories/connections/:id/branches', privateRoute, (request) => {
      const params = z.object({ id }).parse(request.params);
      const query = z.object({ repositoryId }).strict().parse(request.query);
      return service.branches(request.user!.id, params.id, query.repositoryId);
    });
    fastify.get('/intel/repositories/connections/:id/discovery', privateRoute, (request) => {
      const params = z.object({ id }).parse(request.params);
      const query = z.object({ repositoryId, branch }).strict().parse(request.query);
      return service.discovery(request.user!.id, params.id, query);
    });
    fastify.post('/intel/repositories/connections/:id/preview', mutation, (request) => {
      const params = z.object({ id }).parse(request.params);
      return service.preview(request.user!.id, params.id, selection.parse(request.body));
    });
    fastify.post('/intel/repositories/projects', mutation, async (request, reply) => {
      const input = selection
        .extend({
          organizationId: id,
          connectionId: id,
          name: z.string().trim().min(1).max(100),
          environment: z.enum(['production', 'staging', 'development']),
          expectedCommit: z
            .string()
            .regex(/^[a-f0-9]{40,64}$/)
            .optional(),
        })
        .strict()
        .parse(request.body);
      const result = await service.createProject(request.user!.id, input);
      reply.code(201);
      return result;
    });
    fastify.get('/intel/repositories/sources', privateRoute, (request) => {
      const query = z.object({ organizationId: id.optional() }).strict().parse(request.query);
      return service.listSources(request.user!.id, query.organizationId);
    });
    fastify.post('/intel/repositories/sources/:id/sync', mutation, (request) => {
      const params = z.object({ id }).parse(request.params);
      z.object({})
        .strict()
        .parse(request.body ?? {});
      return service.sync(request.user!.id, params.id);
    });
    fastify.patch('/intel/repositories/sources/:id', mutation, (request) => {
      const params = z.object({ id }).parse(request.params);
      const input = z
        .object({
          paused: z.boolean().optional(),
          branch: branch.optional(),
          paths: paths.optional(),
        })
        .strict()
        .refine(
          (value) =>
            value.paused !== undefined || value.branch !== undefined || value.paths !== undefined,
          'Choose a setting to update.',
        )
        .parse(request.body);
      return service.updateSource(request.user!.id, params.id, input);
    });
    fastify.delete(
      '/intel/repositories/sources/:id',
      { ...privateRoute, preHandler: [requireJson, auth] },
      (request) => {
        const params = z.object({ id }).parse(request.params);
        z.object({})
          .strict()
          .parse(request.body ?? {});
        return service.disconnectSource(request.user!.id, params.id);
      },
    );
    fastify.delete(
      '/intel/repositories/connections/:id',
      { ...privateRoute, preHandler: [requireJson, auth] },
      (request) => {
        const params = z.object({ id }).parse(request.params);
        z.object({})
          .strict()
          .parse(request.body ?? {});
        return service.disconnect(request.user!.id, params.id);
      },
    );
    fastify.post(
      '/intel/repositories/webhooks/:provider',
      {
        config: { rawBody: true },
        bodyLimit: 1024 * 1024,
        logLevel: 'silent',
        schema: { hide: true },
      },
      async (request, reply) => {
        const params = z.object({ provider }).parse(request.params);
        const raw = (request as unknown as { rawBody?: string }).rawBody;
        if (typeof raw !== 'string')
          return reply.code(400).send({ error: 'The original webhook body is required.' });
        const names = [
          'x-github-delivery',
          'x-github-event',
          'x-hub-signature-256',
          'webhook-id',
          'webhook-timestamp',
          'webhook-signature',
          'x-gitlab-event',
        ];
        const headers = Object.fromEntries(
          names.map((name) => [
            name,
            typeof request.headers[name] === 'string' ? request.headers[name] : undefined,
          ]),
        );
        const result = await service.webhook(params.provider, raw, headers);
        reply.code(202);
        return result;
      },
    );
  };
}
export const repositoryRoutes = createRepositoryRoutes();
