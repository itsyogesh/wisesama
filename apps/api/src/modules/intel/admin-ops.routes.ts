import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdminJson, requireIntelAdmin } from '../../middleware/admin-access';
import { ADMIN_JOB_KINDS, AdminJobError, adminJobService } from '../../services/admin-job.service';
import { SourceControlError, sourceControlService } from '../../services/source-control.service';

const id = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9._:-]+$/);
const reason = z.string().trim().min(20).max(1000);
const jobId = z.object({ id });
export function createAdminOpsRoutes(
  options: {
    jobs?: typeof adminJobService;
    sources?: typeof sourceControlService;
    authenticate?: typeof requireIntelAdmin;
    jsonGuard?: typeof requireAdminJson;
  } = {},
) {
  const jobs = options.jobs ?? adminJobService,
    sources = options.sources ?? sourceControlService;
  const auth = options.authenticate ?? requireIntelAdmin,
    jsonGuard = options.jsonGuard ?? requireAdminJson;
  return async function register(app: FastifyInstance) {
    app.addHook('onSend', async (_request, reply, payload) => {
      reply.header('Cache-Control', 'private, no-store');
      return payload;
    });
    app.setErrorHandler((error, request, reply) => {
      if (error instanceof z.ZodError)
        return reply.code(400).send({
          error: 'Check the action fields. Include a reason of at least 20 characters.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      if (error instanceof SourceControlError || error instanceof AdminJobError)
        return reply.code(error.statusCode).send({ error: error.message });
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Wisesama operator action failed',
      );
      return reply.code(500).send({
        error: 'The operator request could not complete. Reload the record before retrying.',
      });
    });
    const read = {
      preHandler: [auth],
      schema: { tags: ['intel-admin'], security: [{ cookieAuth: [] }] },
    };
    const write = { ...read, preHandler: [auth, jsonGuard] };
    app.get('/intel/admin/sources', read, () => sources.list());
    app.patch('/intel/admin/sources/:id', write, (request) => {
      const input = z
        .object({
          paused: z.boolean(),
          expectedRevision: z.number().int().min(0).max(2_147_483_646),
          reason,
        })
        .strict()
        .parse(request.body);
      return sources.update(request.user!.id, jobId.parse(request.params).id, input);
    });
    app.get('/intel/admin/jobs', read, (request) =>
      jobs.list(
        z
          .object({
            status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped']).optional(),
            kind: z.string().max(100).optional(),
            q: z.string().trim().max(150).optional(),
            cursor: id.optional(),
            limit: z.coerce.number().int().min(1).max(50).optional(),
          })
          .strict()
          .parse(request.query),
      ),
    );
    app.get('/intel/admin/jobs/:id', read, (request) =>
      jobs.detail(jobId.parse(request.params).id),
    );
    app.post('/intel/admin/jobs', write, (request) =>
      jobs.enqueue(
        request.user!.id,
        z
          .object({ kind: z.enum(ADMIN_JOB_KINDS), targetId: id.optional(), reason })
          .strict()
          .parse(request.body),
      ),
    );
    app.post('/intel/admin/jobs/:id/run', write, (request) => {
      z.object({}).strict().parse(request.body);
      return jobs.run(jobId.parse(request.params).id, request.user!.id);
    });
    app.post('/intel/admin/jobs/:id/retry', write, (request) =>
      jobs.retry(
        request.user!.id,
        jobId.parse(request.params).id,
        z.object({ reason, expectedUpdatedAt: z.string().datetime() }).strict().parse(request.body),
      ),
    );
    app.get('/intel/admin/failures', read, () => jobs.failures());
  };
}
export const adminOpsRoutes = createAdminOpsRoutes();
