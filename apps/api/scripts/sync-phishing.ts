/**
 * Manual script to sync phishing list data
 * Run with: pnpm --filter @wisesama/api sync
 */
import 'dotenv/config';
import { PhishingSyncService } from '../src/services/phishing-sync.service';

async function main() {
  console.log('Starting manual phishing list sync...\n');

  const service = new PhishingSyncService();

  // Get current counts
  const beforeCounts = await service.getEntityCounts();
  console.log('Before sync:');
  console.log(`  Addresses: ${beforeCounts.addresses}`);
  console.log(`  Domains: ${beforeCounts.domains}`);
  console.log(`  Whitelisted: ${beforeCounts.whitelisted}`);
  console.log(`  Total: ${beforeCounts.total}\n`);

  // Run sync
  const startTime = Date.now();
  const result = await service.syncPhishingList();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\nSync completed in ${duration}s:`);
  console.log(`  New addresses: ${result.addresses}`);
  console.log(`  New domains: ${result.domains}`);
  console.log(`  Total synced: ${result.total}`);

  // Get new counts
  const afterCounts = await service.getEntityCounts();
  console.log('\nAfter sync:');
  console.log(`  Addresses: ${afterCounts.addresses}`);
  console.log(`  Domains: ${afterCounts.domains}`);
  console.log(`  Whitelisted: ${afterCounts.whitelisted}`);
  console.log(`  Total: ${afterCounts.total}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
