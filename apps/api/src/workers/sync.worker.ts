import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { phishingSyncService } from '../services/phishing-sync.service';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection for BullMQ
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Queue for sync jobs
export const syncQueue = new Queue('phishing-sync', { connection });

// Worker to process sync jobs
export const syncWorker = new Worker(
  'phishing-sync',
  async (job) => {
    console.log(`[SyncWorker] Processing job ${job.id}: ${job.name}`);

    switch (job.name) {
      case 'sync-phishing-list':
        const result = await phishingSyncService.syncPhishingList();
        console.log(`[SyncWorker] Sync complete:`, result);
        return result;

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  },
  {
    connection,
    concurrency: 1, // Process one job at a time
  }
);

// Event handlers
syncWorker.on('completed', (job, result) => {
  console.log(`[SyncWorker] Job ${job.id} completed:`, result);
});

syncWorker.on('failed', (job, err) => {
  console.error(`[SyncWorker] Job ${job?.id} failed:`, err.message);
});

// Schedule recurring sync (every 15 minutes)
export async function scheduleRecurringSync() {
  // Remove existing repeatable jobs
  const repeatableJobs = await syncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await syncQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job
  await syncQueue.add(
    'sync-phishing-list',
    {},
    {
      repeat: {
        pattern: '*/15 * * * *', // Every 15 minutes
      },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    }
  );

  console.log('[SyncWorker] Scheduled recurring sync every 15 minutes');
}

// Run initial sync
export async function runInitialSync() {
  const status = await phishingSyncService.getSyncStatus();

  // If never synced or last sync was more than 1 hour ago, sync now
  if (!status?.lastSyncAt || Date.now() - status.lastSyncAt.getTime() > 60 * 60 * 1000) {
    console.log('[SyncWorker] Running initial sync...');
    await syncQueue.add('sync-phishing-list', {}, { priority: 1 });
  } else {
    const counts = await phishingSyncService.getEntityCounts();
    console.log(`[SyncWorker] Using existing data: ${counts.total} entities`);
  }
}

// Graceful shutdown
export async function shutdownWorker() {
  await syncWorker.close();
  await syncQueue.close();
  connection.disconnect();
  console.log('[SyncWorker] Shutdown complete');
}
