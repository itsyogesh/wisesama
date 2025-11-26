import type { FastifyInstance } from 'fastify';
import { phishingSyncService } from '../../services/phishing-sync.service';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';

export async function adminRoutes(fastify: FastifyInstance) {
  // Trigger manual sync (redirects to the jobs endpoint)
  fastify.post(
    '/admin/sync',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Trigger a manual phishing list sync',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const result = await phishingSyncService.syncPhishingList();
      return {
        message: 'Sync completed',
        ...result,
      };
    }
  );

  // Run sync immediately (blocking)
  fastify.post(
    '/admin/sync/now',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Run sync immediately and wait for result',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              addresses: { type: 'number' },
              domains: { type: 'number' },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async () => {
      const result = await phishingSyncService.syncPhishingList();
      return result;
    }
  );

  // Get sync status
  fastify.get(
    '/admin/sync/status',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get phishing list sync status',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              status: {
                type: 'object',
                properties: {
                  sourceName: { type: 'string' },
                  lastSyncAt: { type: ['string', 'null'] },
                  recordsProcessed: { type: 'number' },
                  lastError: { type: ['string', 'null'] },
                },
              },
              counts: {
                type: 'object',
                properties: {
                  addresses: { type: 'number' },
                  domains: { type: 'number' },
                  whitelisted: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const [status, counts] = await Promise.all([
        phishingSyncService.getSyncStatus(),
        phishingSyncService.getEntityCounts(),
      ]);

      return { status, counts };
    }
  );
}
