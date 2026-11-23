import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdminJson, requireIntelAdmin } from '../../middleware/admin-access';
import { IntelAdminError, intelAdminService } from '../../services/admin.service';

const identifier = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._:-]+$/);
const idParams = z.object({ id: identifier }).strict();
const listQuery = z.object({
  q: z.string().trim().max(150).optional(),
  cursor: z.string().max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const reason = z.string().trim().min(10, 'Add a reason of at least 10 characters.').max(1000);
const revision = z.number().int().min(0).max(2_147_483_646);
const accessInput = z
  .object({ suspended: z.boolean(), expectedRevision: revision, reason })
  .strict();
const reviewInput = z
  .object({
    expectedRevision: revision,
    visibility: z.enum(['published', 'hidden']),
    guidance: z.string().trim().max(4000),
    note: z.string().trim().max(4000),
    reason,
  })
  .strict();
const subscriberInput = z
  .object({ status: z.enum(['unsubscribed', 'suppressed']), expectedRevision: revision, reason })
  .strict();

export function createIntelAdminRoutes(
  options: {
    service?: typeof intelAdminService;
    guard?: typeof requireIntelAdmin;
    jsonGuard?: typeof requireAdminJson;
  } = {},
) {
  const service = options.service ?? intelAdminService;
  const guard = options.guard ?? requireIntelAdmin;
  const jsonGuard = options.jsonGuard ?? requireAdminJson;
  return async function registerIntelAdminRoutes(app: FastifyInstance) {
    app.addHook('onSend', async (_request, reply, payload) => {
      reply.header('Cache-Control', 'private, no-store');
      reply.header('Vary', 'Cookie, Origin');
      return payload;
    });
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof z.ZodError)
        return reply
          .code(400)
          .send({ error: error.issues[0]?.message ?? 'Check the request fields.' });
      if (error instanceof IntelAdminError)
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
        'Wisesama admin request failed',
      );
      return reply
        .code(statusCode >= 400 && statusCode < 500 ? statusCode : 500)
        .send({ error: 'This admin request could not complete. Try again.' });
    });
    const read = {
      preHandler: [guard],
      schema: { tags: ['intel-admin'], security: [{ cookieAuth: [] }] },
    };
    const write = { ...read, preHandler: [guard, jsonGuard] };
    app.get('/intel/admin/session', read, (request) => ({
      user: { id: request.user!.id, email: request.user!.email, name: null },
      access: 'intel_admin',
    }));
    app.get('/intel/admin/overview', read, () => service.overview());
    app.get('/intel/admin/users', read, (request) =>
      service.users(
        listQuery
          .extend({ status: z.enum(['active', 'suspended']).optional() })
          .strict()
          .parse(request.query),
      ),
    );
    app.get('/intel/admin/users/:id', read, (request) =>
      service.user(idParams.parse(request.params).id),
    );
    app.patch('/intel/admin/users/:id/access', write, (request) =>
      service.access(
        request.user!.id,
        idParams.parse(request.params).id,
        accessInput.parse(request.body),
      ),
    );
    app.get('/intel/admin/advisories', read, (request) =>
      service.advisories(
        listQuery
          .extend({ visibility: z.enum(['published', 'hidden']).optional() })
          .strict()
          .parse(request.query),
      ),
    );
    app.get('/intel/admin/advisories/:id', read, (request) =>
      service.advisory(idParams.parse(request.params).id),
    );
    app.patch('/intel/admin/advisories/:id/review', write, (request) =>
      service.review(
        request.user!.id,
        idParams.parse(request.params).id,
        reviewInput.parse(request.body),
      ),
    );
    app.get('/intel/admin/subscriptions', read, (request) =>
      service.subscriptions(
        listQuery
          .extend({
            status: z.enum(['active', 'pending', 'unsubscribed', 'suppressed']).optional(),
          })
          .strict()
          .parse(request.query),
      ),
    );
    app.get('/intel/admin/subscriptions/:id', read, (request) =>
      service.subscription(idParams.parse(request.params).id),
    );
    app.patch('/intel/admin/subscriptions/:id/status', write, (request) =>
      service.subscriptionStatus(
        request.user!.id,
        idParams.parse(request.params).id,
        subscriberInput.parse(request.body),
      ),
    );
    app.get('/intel/admin/audit', read, (request) =>
      service.audit(
        listQuery
          .omit({ q: true })
          .extend({ targetType: z.string().max(60).optional(), targetId: identifier.optional() })
          .strict()
          .parse(request.query),
      ),
    );
  };
}
export const intelAdminRoutes = createIntelAdminRoutes();
