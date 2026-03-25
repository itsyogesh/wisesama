/**
 * Backfill all on-chain identities from People Chains.
 *
 * Usage:
 *   pnpm --filter @wisesama/api backfill-identities
 *   pnpm --filter @wisesama/api backfill-identities --chain=polkadot
 *   pnpm --filter @wisesama/api backfill-identities --chain=kusama
 */
import 'dotenv/config';
import { identitySyncService } from '../src/services/identity-sync.service';

async function main() {
  const chainArg = process.argv.find((a) => a.startsWith('--chain='))?.split('=')[1] || 'all';

  console.log(`\n=== Wisesama Identity Backfill ===`);
  console.log(`Chain: ${chainArg}\n`);

  if (chainArg === 'all' || chainArg === 'polkadot') {
    const result = await identitySyncService.syncChain('polkadot');
    console.log(`\nPolkadot: ${result.synced} synced, ${result.removed} removed, ${result.errors} errors (${result.duration}ms)\n`);
  }

  if (chainArg === 'all' || chainArg === 'kusama') {
    const result = await identitySyncService.syncChain('kusama');
    console.log(`\nKusama: ${result.synced} synced, ${result.removed} removed, ${result.errors} errors (${result.duration}ms)\n`);
  }

  console.log('=== Backfill complete ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
