import type { FastifyInstance } from 'fastify';
import { Receiver } from '@upstash/qstash';
import { phishingSyncService } from '../../services/phishing-sync.service';

// QStash signature verification
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function jobsRoutes(fastify: FastifyInstance) {
  // Phishing sync job - called by QStash CRON
  fastify.post(
    '/jobs/sync-phishing',
    {
      schema: {
        tags: ['jobs'],
        description: 'Sync phishing data from polkadot-js/phishing (called by QStash)',
        hide: true, // Hide from Swagger docs
      },
      config: {
        rawBody: true, // Need raw body for signature verification
      },
    },
    async (request, reply) => {
      // Verify QStash signature in production
      if (process.env.NODE_ENV === 'production' || process.env.QSTASH_CURRENT_SIGNING_KEY) {
        const signature = request.headers['upstash-signature'] as string;
        const body = (request as unknown as { rawBody: string }).rawBody || JSON.stringify(request.body) || '';

        // Construct URL from request headers (Vercel sets x-forwarded-* headers)
        const protocol = (request.headers['x-forwarded-proto'] as string) || 'https';
        const host = (request.headers['x-forwarded-host'] as string) || (request.headers.host as string);
        const requestUrl = `${protocol}://${host}${request.url}`;

        try {
          const isValid = await receiver.verify({
            signature,
            body,
            url: requestUrl,
          });

          if (!isValid) {
            request.log.warn({ requestUrl }, 'Invalid QStash signature');
            reply.status(401);
            return { error: 'Invalid signature' };
          }
        } catch (err) {
          request.log.error({ err, requestUrl, body: body.substring(0, 100) }, 'QStash signature verification failed');
          reply.status(401);
          return { error: 'Signature verification failed' };
        }
      }

      try {
        request.log.info('Starting phishing sync job');
        const result = await phishingSyncService.syncPhishingList();
        request.log.info({ result }, 'Phishing sync completed');

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        request.log.error({ error }, 'Phishing sync failed');
        reply.status(500);
        return { error: 'Sync failed' };
      }
    }
  );

  // Manual sync trigger (admin only, for testing)
  fastify.post(
    '/jobs/sync-phishing/trigger',
    {
      schema: {
        tags: ['jobs'],
        description: 'Manually trigger phishing sync (for testing)',
      },
    },
    async (request, reply) => {
      // In production, this should require admin auth
      // For now, allow in development only
      if (process.env.NODE_ENV === 'production') {
        reply.status(403);
        return { error: 'Manual trigger disabled in production' };
      }

      try {
        request.log.info('Manual phishing sync triggered');
        const result = await phishingSyncService.syncPhishingList();
        return {
          success: true,
          ...result,
        };
      } catch (error) {
        request.log.error({ error }, 'Manual sync failed');
        reply.status(500);
        return { error: 'Sync failed' };
      }
    }
  );

  // Get sync status
  fastify.get(
    '/jobs/sync-status',
    {
      schema: {
        tags: ['jobs'],
        description: 'Get current sync status',
      },
    },
    async () => {
      const [status, counts] = await Promise.all([
        phishingSyncService.getSyncStatus(),
        phishingSyncService.getEntityCounts(),
      ]);

      return {
        lastSyncAt: status?.lastSyncAt,
        lastSyncHash: status?.lastSyncHash,
        recordsProcessed: status?.recordsProcessed,
        lastError: status?.lastError,
        entityCounts: counts,
      };
    }
  );
}
