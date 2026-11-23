import { Receiver } from '@upstash/qstash';
import type { FastifyInstance } from 'fastify';
import { adminJobService } from '../../services/admin-job.service';
import { intelWorkspaceService } from '../../services/intel-workspace.service';
import { publicSubscriptionService } from '../../services/public-subscription.service';
import { repositoryService } from '../../services/repository.service';

/** A signed scheduler call refreshes a bounded batch and retries due deliveries. */
export async function intelJobsRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/jobs/security-response',
    {
      config: { rawBody: true },
      schema: { tags: ['jobs'], hide: true },
    },
    async (request, reply) => {
      const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
      const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
      if (!currentSigningKey || !nextSigningKey) {
        return reply.code(503).send({ error: 'Security-response scheduling is not configured.' });
      }
      const signature = request.headers['upstash-signature'];
      if (typeof signature !== 'string')
        return reply.code(401).send({ error: 'Scheduler signature required.' });

      const protocol = request.headers['x-forwarded-proto'] || request.protocol;
      const host = request.headers['x-forwarded-host'] || request.headers.host;
      const url = `${protocol}://${host}${request.url}`;
      const body =
        (request as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(request.body ?? {});
      try {
        const receiver = new Receiver({ currentSigningKey, nextSigningKey });
        const valid = await receiver.verify({ signature, body, url });
        if (!valid) return reply.code(401).send({ error: 'Invalid scheduler signature.' });
      } catch {
        return reply.code(401).send({ error: 'Invalid scheduler signature.' });
      }

      const operatorJobs = await adminJobService.runPending(3);
      const repositories = await adminJobService.recordScheduledStage('repository_sync', () =>
        repositoryService.runScheduledSyncs(3),
      );
      const assessments = await adminJobService.recordScheduledStage('assessment', () =>
        intelWorkspaceService.runScheduledScans(3),
      );
      const publicFeed = await adminJobService.recordScheduledStage('public_digest', () =>
        publicSubscriptionService.runDailyDigest(25),
      );
      return { operatorJobs, repositories, assessments, publicFeed };
    },
  );
}
