import type { FastifyInstance } from 'fastify';
import { phishingSyncService } from '../../services/phishing-sync.service';
import { syncQueue } from '../../workers/sync.worker';

export async function adminRoutes(fastify: FastifyInstance) {
  // Trigger manual sync
  fastify.post('/sync', {
    schema: {
      tags: ['admin'],
      description: 'Trigger a manual phishing list sync',
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            jobId: { type: 'string' },
          },
        },
      },
    },
    handler: async () => {
      const job = await syncQueue.add('sync-phishing-list', {}, { priority: 1 });
      return {
        message: 'Sync job queued',
        jobId: job.id,
      };
    },
  });

  // Run sync immediately (blocking)
  fastify.post('/sync/now', {
    schema: {
      tags: ['admin'],
      description: 'Run sync immediately and wait for result',
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
    handler: async () => {
      const result = await phishingSyncService.syncPhishingList();
      return result;
    },
  });

  // Get sync status
  fastify.get('/sync/status', {
    schema: {
      tags: ['admin'],
      description: 'Get phishing list sync status',
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
    handler: async () => {
      const [status, counts] = await Promise.all([
        phishingSyncService.getSyncStatus(),
        phishingSyncService.getEntityCounts(),
      ]);

      return { status, counts };
    },
  });

  // Get queue status
  fastify.get('/queue/status', {
    schema: {
      tags: ['admin'],
      description: 'Get background job queue status',
    },
    handler: async () => {
      const [waiting, active, completed, failed] = await Promise.all([
        syncQueue.getWaitingCount(),
        syncQueue.getActiveCount(),
        syncQueue.getCompletedCount(),
        syncQueue.getFailedCount(),
      ]);

      return {
        queue: 'phishing-sync',
        counts: { waiting, active, completed, failed },
      };
    },
  });
}
