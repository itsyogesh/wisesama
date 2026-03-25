import { encodeAddress } from '@polkadot/util-crypto';
import { prisma } from '@wisesama/database';
import { PolkadotService, getIdentitySource, getChainCode, SS58_PREFIXES } from './polkadot.service';
import { parseField } from '../utils/sanitize';
import { normalizeTwitter, normalizeWeb, normalizeGithub } from '../utils/normalize';
import { cacheDel, cacheKeys } from '../lib/redis';

const polkadotService = new PolkadotService();

export interface SyncResult {
  total: number;
  synced: number;
  errors: number;
  removed: number;
  duration: number;
}

/**
 * Parse info.additional Vec<[Data, Data]> key-value tuples into structured fields.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAdditionalFields(additional: any): {
  github: string | null;
  discord: string | null;
  matrix: string | null;
  all: Record<string, string>;
} {
  const all: Record<string, string> = {};
  let github: string | null = null;
  let discord: string | null = null;
  let matrix: string | null = null;

  if (!additional) return { github, discord, matrix, all };

  try {
    const entries = additional.toHuman ? additional.toHuman() : additional;
    if (!Array.isArray(entries)) return { github, discord, matrix, all };

    for (const tuple of entries) {
      if (!Array.isArray(tuple) || tuple.length < 2) continue;

      const rawKey = typeof tuple[0] === 'object' ? tuple[0]?.Raw : tuple[0];
      const rawValue = typeof tuple[1] === 'object' ? tuple[1]?.Raw : tuple[1];

      const key = typeof rawKey === 'string' ? rawKey.toLowerCase().trim() : null;
      const value = typeof rawValue === 'string' ? rawValue.trim() : null;

      if (!key || !value) continue;

      all[key] = value;

      if (['github', 'gh', 'git', 'github.com'].includes(key)) {
        github = value;
      } else if (['discord', 'disc'].includes(key)) {
        discord = value;
      } else if (['matrix', 'element', 'riot'].includes(key)) {
        matrix = value;
      }
    }
  } catch (err) {
    console.error('[IdentitySync] Error parsing additional fields:', err);
  }

  return { github, discord, matrix, all };
}

/**
 * Parse a registration object from the identity pallet into structured data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseRegistration(registration: any) {
  const info = registration.info;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const judgements = registration.judgements.map((item: any) => {
    const [registrarId, judgement] = item;
    return {
      registrarId: Number(registrarId.toString()),
      judgement: judgement.type || judgement.toString(),
    };
  });

  const isVerified = judgements.some(
    (j: { registrarId: number; judgement: string }) =>
      ['Reasonable', 'KnownGood'].includes(j.judgement)
  );

  const identityInfo = {
    displayName: parseField(info.display),
    legalName: parseField(info.legal),
    email: parseField(info.email),
    twitter: parseField(info.twitter),
    web: parseField(info.web),
    riot: parseField(info.riot),
  };

  const additional = parseAdditionalFields(info.additional);

  return { identityInfo, judgements, isVerified, additional };
}

export class IdentitySyncService {
  /**
   * Sync all identities for a chain from People Chain storage.
   * Used by both the CLI backfill script and the daily cron job.
   */
  async syncChain(chain: string): Promise<SyncResult> {
    const startTime = Date.now();
    const ss58Prefix = SS58_PREFIXES[chain] ?? 0;
    const identitySource = getIdentitySource(chain);
    const chainCode = getChainCode(chain);
    const syncStartedAt = new Date();

    console.log(`[IdentitySync] Starting sync for ${chain} People Chain...`);

    const api = await polkadotService.getPeopleChainClient(chain);

    if (!api.query.identity?.identityOf) {
      throw new Error(`Identity pallet not available on ${chain} People chain`);
    }

    // Fetch all identity entries
    console.log(`[IdentitySync] Fetching identityOf entries...`);
    const entries = await api.query.identity.identityOf.entries();
    console.log(`[IdentitySync] Found ${entries.length} entries on ${chain}`);

    const chainRecord = await prisma.chain.findUnique({ where: { code: chainCode } });
    if (!chainRecord) {
      throw new Error(`Chain record not found for code: ${chainCode}`);
    }

    let synced = 0;
    let errors = 0;

    // Process in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async ([storageKey, optionValue]) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const accountId = (storageKey.args as any)[0];
          if (!accountId) return;

          const address = encodeAddress(accountId, ss58Prefix);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const optVal = optionValue as any;
          if (optVal.isNone) return;

          const unwrapped = optVal.unwrap();
          const registration = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;

          const { identityInfo, judgements, isVerified, additional } = parseRegistration(registration);

          await prisma.identity.upsert({
            where: { address_source: { address, source: identitySource } },
            create: {
              address,
              source: identitySource,
              chainId: chainRecord.id,
              displayName: identityInfo.displayName,
              legalName: identityInfo.legalName,
              email: identityInfo.email,
              twitter: normalizeTwitter(identityInfo.twitter),
              web: normalizeWeb(identityInfo.web),
              riot: identityInfo.riot,
              github: normalizeGithub(additional.github),
              discord: additional.discord,
              matrix: additional.matrix,
              additionalFields: additional.all,
              hasIdentity: true,
              isVerified,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              judgements: judgements as any,
              lastSyncedAt: syncStartedAt,
            },
            update: {
              displayName: identityInfo.displayName,
              legalName: identityInfo.legalName,
              email: identityInfo.email,
              twitter: normalizeTwitter(identityInfo.twitter),
              web: normalizeWeb(identityInfo.web),
              riot: identityInfo.riot,
              github: normalizeGithub(additional.github),
              discord: additional.discord,
              matrix: additional.matrix,
              additionalFields: additional.all,
              hasIdentity: true,
              isVerified,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              judgements: judgements as any,
              lastSyncedAt: syncStartedAt,
            },
          });

          // Invalidate Redis cache
          await cacheDel(cacheKeys.identity(address, chain));

          synced++;
        } catch (err) {
          errors++;
          console.error(`[IdentitySync] Error processing entry:`, err);
        }
      });

      await Promise.all(promises);

      if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= entries.length) {
        console.log(`[IdentitySync] Progress: ${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} (synced=${synced}, errors=${errors})`);
      }
    }

    // Cleanup: mark identities not touched during this sync as cleared
    const removed = await this.cleanupStaleIdentities(identitySource, syncStartedAt);

    const duration = Date.now() - startTime;
    console.log(`[IdentitySync] Completed ${chain}: ${synced} synced, ${removed} removed, ${errors} errors in ${duration}ms`);

    return { total: entries.length, synced, errors, removed, duration };
  }

  /**
   * Mark identities as cleared if they weren't updated during this sync run.
   * This catches identities that were removed on-chain (clearIdentity).
   */
  private async cleanupStaleIdentities(
    source: 'POLKADOT_PEOPLE' | 'KUSAMA_PEOPLE',
    syncStartedAt: Date
  ): Promise<number> {
    const result = await prisma.identity.updateMany({
      where: {
        source,
        hasIdentity: true,
        lastSyncedAt: { lt: syncStartedAt },
      },
      data: { hasIdentity: false },
    });

    if (result.count > 0) {
      console.log(`[IdentitySync] Marked ${result.count} stale identities as cleared for ${source}`);
    }

    return result.count;
  }
}

export const identitySyncService = new IdentitySyncService();
