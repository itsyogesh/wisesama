import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticateIntel } from '../../middleware/intel-access.middleware';
import { organizationService } from '../../services/organization.service';
import { OrganizationError } from '../../services/organization-access';

const identifier = z
  .string()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9._-]+$/);
const tokenSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);
const name = z.string().trim().min(2).max(80);
const revision = z.number().int().min(0).max(2_147_483_646);
const reason = z.string().trim().min(10).max(500).optional();
const organizationParams = z.object({ id: identifier });
const memberParams = organizationParams.extend({ memberId: identifier });
const invitationParams = organizationParams.extend({ invitationId: identifier });
const tokenParams = z.object({ token: tokenSchema });
const change = z.object({ expectedRevision: revision, reason }).strict();

/** Organization management requires a browser session, never a workspace API key. */
async function sessionOnly(request: FastifyRequest, reply: FastifyReply) {
  reply.header('Cache-Control', 'no-store');
  reply.header('Referrer-Policy', 'no-referrer');
  if (request.headers['x-api-key'])
    return reply.code(401).send({ error: 'Sign in to manage organization membership.' });
}

export function createOrganizationRoutes(
  options: {
    service?: typeof organizationService;
    authenticate?: typeof authenticateIntel;
    env?: NodeJS.ProcessEnv;
  } = {},
) {
  const service = options.service ?? organizationService;
  const authenticate = options.authenticate ?? authenticateIntel;
  const env = options.env ?? process.env;
  const origins = new Set<string>();
  if (env.INTEL_APP_URL) {
    try {
      const url = new URL(env.INTEL_APP_URL);
      if (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
      )
        origins.add(url.origin);
    } catch {
      /* Invalid configuration fails closed. */
    }
  }
  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3003');
    origins.add('http://127.0.0.1:3003');
  }
  async function requireJson(request: FastifyRequest, reply: FastifyReply) {
    if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
      return reply.code(415).send({ error: 'Use application/json for this action.' });
    if (typeof request.headers.origin !== 'string' || !origins.has(request.headers.origin))
      return reply.code(403).send({ error: 'Open this action from Wisesama.' });
  }
  return async function registerOrganizationRoutes(app: FastifyInstance) {
    app.setErrorHandler((error, request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: 'Check the organization fields and try again.' });
      if (error instanceof OrganizationError)
        return reply.code(error.statusCode).send({ error: error.message });
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 400)
        return reply.code(400).send({ error: 'Check the organization fields and try again.' });
      // Never log request tokens, email addresses or invitation payloads.
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Organization request failed',
      );
      return reply.code(500).send({ error: 'The organization could not be updated. Try again.' });
    });
    const read = [sessionOnly, authenticate];
    const write = [sessionOnly, authenticate, requireJson];
    app.get('/intel/organizations', { preHandler: read }, (request) =>
      service.list(request.user!.id),
    );
    app.post('/intel/organizations', { preHandler: write }, async (request, reply) => {
      const result = await service.create(
        request.user!.id,
        z.object({ name }).strict().parse(request.body),
      );
      return reply.code(201).send(result);
    });
    app.get('/intel/organizations/:id', { preHandler: read }, (request) => {
      const { id } = organizationParams.parse(request.params);
      return service.get(request.user!.id, id);
    });
    app.patch('/intel/organizations/:id', { preHandler: write }, (request) => {
      const { id } = organizationParams.parse(request.params);
      return service.rename(
        request.user!.id,
        id,
        z.object({ name, expectedRevision: revision }).strict().parse(request.body),
      );
    });
    app.post(
      '/intel/organizations/:id/invitations',
      { preHandler: write },
      async (request, reply) => {
        const { id } = organizationParams.parse(request.params);
        const body = z
          .object({ email: z.string().trim().email().max(254), role: z.enum(['admin', 'member']) })
          .strict()
          .parse(request.body);
        return reply.code(201).send(await service.invite(request.user!.id, id, body));
      },
    );
    app.post(
      '/intel/organizations/:id/invitations/:invitationId/revoke',
      { preHandler: write },
      (request) => {
        const { id, invitationId } = invitationParams.parse(request.params);
        return service.revokeInvitation(
          request.user!.id,
          id,
          invitationId,
          change.parse(request.body),
        );
      },
    );
    app.patch('/intel/organizations/:id/members/:memberId', { preHandler: write }, (request) => {
      const { id, memberId } = memberParams.parse(request.params);
      return service.changeMember(
        request.user!.id,
        id,
        memberId,
        change
          .extend({ role: z.enum(['owner', 'admin', 'member']) })
          .strict()
          .parse(request.body),
      );
    });
    app.delete('/intel/organizations/:id/members/:memberId', { preHandler: write }, (request) => {
      const { id, memberId } = memberParams.parse(request.params);
      return service.removeMember(request.user!.id, id, memberId, change.parse(request.body));
    });
    app.get('/intel/organization-invitations/:token', async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      reply.header('Referrer-Policy', 'no-referrer');
      const { token } = tokenParams.parse(request.params);
      return service.invitation(token);
    });
    app.post('/intel/organization-invitations/:token/accept', { preHandler: write }, (request) => {
      const { token } = tokenParams.parse(request.params);
      z.object({}).strict().parse(request.body);
      return service.acceptInvitation(request.user!.id, token);
    });
  };
}

export const organizationRoutes = createOrganizationRoutes();
