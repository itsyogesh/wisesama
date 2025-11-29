import { prisma } from '@wisesama/database';
import type { LinkedIdentitiesResult, LinkedIdentity, IdentitySource } from '@wisesama/types';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

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
    // Normalize: lowercase, remove @ prefix
    const normalized = handle.replace(/^@/, '').toLowerCase().trim();

    if (!normalized) {
      return { found: false, count: 0, identities: [] };
    }

    // Check cache first
    const cacheKey = cacheKeys.reverseTwitter(normalized);
    const cached = await cacheGet<LinkedIdentitiesResult>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Query Identity table with indexed twitter field
      const identities = await prisma.identity.findMany({
        where: {
          twitter: normalized,
          hasIdentity: true,
        },
        include: {
          chain: true,
        },
        take: MAX_RESULTS + 1, // Get one extra to check if there are more
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
          matchedField: 'twitter',
          judgements: Array.isArray(identity.judgements)
            ? (identity.judgements as Array<{ registrarId: number; judgement: string }>)
            : [],
        })),
        hasMore,
      };

      // Cache the result
      await cacheSet(cacheKey, result, REVERSE_LOOKUP_CACHE_TTL);

      return result;
    } catch (error) {
      console.error('[ReverseLookup] Error finding by Twitter:', error);
      return { found: false, count: 0, identities: [] };
    }
  }

  async findByDomain(domain: string): Promise<LinkedIdentitiesResult> {
    // Normalize: lowercase, remove protocol and www, extract domain only
    const parts = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/');
    const normalized = parts[0]?.trim() || '';

    if (!normalized) {
      return { found: false, count: 0, identities: [] };
    }

    // Check cache first
    const cacheKey = cacheKeys.reverseDomain(normalized);
    const cached = await cacheGet<LinkedIdentitiesResult>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Query Identity table with indexed web field
      const identities = await prisma.identity.findMany({
        where: {
          web: normalized,
          hasIdentity: true,
        },
        include: {
          chain: true,
        },
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
          matchedField: 'web',
          judgements: Array.isArray(identity.judgements)
            ? (identity.judgements as Array<{ registrarId: number; judgement: string }>)
            : [],
        })),
        hasMore,
      };

      // Cache the result
      await cacheSet(cacheKey, result, REVERSE_LOOKUP_CACHE_TTL);

      return result;
    } catch (error) {
      console.error('[ReverseLookup] Error finding by domain:', error);
      return { found: false, count: 0, identities: [] };
    }
  }
}
