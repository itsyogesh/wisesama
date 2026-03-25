import { prisma } from '@wisesama/database';
import type { LinkedIdentitiesResult, LinkedIdentity, IdentitySource } from '@wisesama/types';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';
import { normalizeTwitter, normalizeWeb, normalizeGithub } from '../utils/normalize';

// Cache TTL: 30 minutes for reverse lookups
const REVERSE_LOOKUP_CACHE_TTL = 1800;
const MAX_RESULTS = 10;

// Map IdentitySource enum to chain name
function getChainName(source: string): string {
  switch (source) {
    case 'POLKADOT_PEOPLE':
      return 'polkadot';
    case 'KUSAMA_PEOPLE':
      return 'kusama';
    case 'KILT':
      return 'kilt';
    default:
      return 'unknown';
  }
}

export class ReverseLookupService {
  async findByTwitter(handle: string): Promise<LinkedIdentitiesResult> {
    return this.findByField('twitter', handle, normalizeTwitter, cacheKeys.reverseTwitter);
  }

  async findByDomain(domain: string): Promise<LinkedIdentitiesResult> {
    return this.findByField('web', domain, normalizeWeb, cacheKeys.reverseDomain);
  }

  async findByGithub(username: string): Promise<LinkedIdentitiesResult> {
    return this.findByField('github', username, normalizeGithub, cacheKeys.reverseGithub);
  }

  /**
   * Generic reverse lookup: find on-chain identities by a specific field value.
   */
  private async findByField(
    field: 'twitter' | 'web' | 'github',
    value: string,
    normalize: (v: string) => string | null,
    getCacheKey: (v: string) => string,
  ): Promise<LinkedIdentitiesResult> {
    const normalized = normalize(value);

    if (!normalized) {
      return { found: false, count: 0, identities: [] };
    }

    // Check cache
    const cacheKey = getCacheKey(normalized);
    const cached = await cacheGet<LinkedIdentitiesResult>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const identities = await prisma.identity.findMany({
        where: {
          [field]: normalized,
          hasIdentity: true,
        },
        include: { chain: true },
        take: MAX_RESULTS + 1,
        orderBy: [
          { isVerified: 'desc' },
          { lastSyncedAt: 'desc' },
        ],
      });

      const hasMore = identities.length > MAX_RESULTS;
      const limitedIdentities = identities.slice(0, MAX_RESULTS);

      const result: LinkedIdentitiesResult = {
        found: limitedIdentities.length > 0,
        count: limitedIdentities.length,
        identities: limitedIdentities.map((identity): LinkedIdentity => ({
          address: identity.address,
          chain: getChainName(identity.source),
          displayName: identity.displayName,
          isVerified: identity.isVerified,
          source: identity.source as IdentitySource,
          matchedField: field === 'web' ? 'web' : field,
          judgements: Array.isArray(identity.judgements)
            ? (identity.judgements as Array<{ registrarId: number; judgement: string }>)
            : [],
        })),
        hasMore,
      };

      await cacheSet(cacheKey, result, REVERSE_LOOKUP_CACHE_TTL);
      return result;
    } catch (error) {
      console.error(`[ReverseLookup] Error finding by ${field}:`, error);
      return { found: false, count: 0, identities: [] };
    }
  }
}
