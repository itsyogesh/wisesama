import { ApiPromise, WsProvider } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { prisma } from '@wisesama/database';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';
import { parseField } from '../utils/sanitize';
import { normalizeTwitter, normalizeWeb, normalizeGithub } from '../utils/normalize';

// SS58 prefixes for each chain (for address normalization)
const SS58_PREFIXES: Record<string, number> = {
  polkadot: 0,
  kusama: 2,
};

// Cache TTL: 1 hour for identity lookups
const IDENTITY_CACHE_TTL = 3600;

// Map chain name to IdentitySource enum
function getIdentitySource(chain: string): 'POLKADOT_PEOPLE' | 'KUSAMA_PEOPLE' {
  return chain === 'polkadot' ? 'POLKADOT_PEOPLE' : 'KUSAMA_PEOPLE';
}

// Map chain name to chain code in database
function getChainCode(chain: string): string {
  return chain === 'polkadot' ? 'dot' : chain === 'kusama' ? 'ksm' : chain;
}

// Relay chain RPC endpoints (for general queries)
const RPC_ENDPOINTS: Record<string, string> = {
  polkadot: process.env.POLKADOT_RPC || 'wss://rpc.polkadot.io',
  kusama: process.env.KUSAMA_RPC || 'wss://kusama-rpc.polkadot.io',
};

// People chain RPC endpoints (for identity queries - identity migrated from relay chain)
const PEOPLE_CHAIN_RPC_ENDPOINTS: Record<string, string> = {
  polkadot: process.env.POLKADOT_PEOPLE_RPC || 'wss://polkadot-people-rpc.polkadot.io',
  kusama: process.env.KUSAMA_PEOPLE_RPC || 'wss://kusama-people-rpc.polkadot.io',
};

// Exported for use by identity-sync service
export { getIdentitySource, getChainCode, SS58_PREFIXES };

export class PolkadotService {
  private clients: Map<string, ApiPromise> = new Map();
  private peopleChainClients: Map<string, ApiPromise> = new Map();

  private async getClient(chain: string): Promise<ApiPromise> {
    if (this.clients.has(chain)) {
      const client = this.clients.get(chain)!;
      // Check if still connected
      if (client.isConnected) {
        return client;
      }
      // Disconnect stale client
      await client.disconnect();
      this.clients.delete(chain);
    }

    const endpoint = RPC_ENDPOINTS[chain];
    if (!endpoint) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider });

    // Ensure API is fully ready with metadata loaded
    await api.isReady;

    this.clients.set(chain, api);
    return api;
  }

  /**
   * Get People chain client for identity queries.
   * Public so identity-sync service can reuse the connection.
   */
  async getPeopleChainClient(chain: string): Promise<ApiPromise> {
    const cacheKey = `${chain}-people`;
    if (this.peopleChainClients.has(cacheKey)) {
      const client = this.peopleChainClients.get(cacheKey)!;
      if (client.isConnected) {
        return client;
      }
      await client.disconnect();
      this.peopleChainClients.delete(cacheKey);
    }

    const endpoint = PEOPLE_CHAIN_RPC_ENDPOINTS[chain];
    if (!endpoint) {
      throw new Error(`Unknown chain for People parachain: ${chain}`);
    }

    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider });

    await api.isReady;

    this.peopleChainClients.set(cacheKey, api);
    return api;
  }

  async getIdentity(
    address: string,
    chain: string = 'polkadot'
  ): Promise<{
    address: string;
    chain: string;
    hasIdentity: boolean;
    isVerified: boolean;
    identity: {
      displayName: string | null;
      legalName: string | null;
      email: string | null;
      twitter: string | null;
      web: string | null;
      riot: string | null;
      github: string | null;
      discord: string | null;
      matrix: string | null;
    } | null;
    judgements: Array<{ registrarId: number; judgement: string }>;
  }> {
    const ss58Prefix = SS58_PREFIXES[chain] ?? 0;
    let normalizedAddress: string;
    try {
      const decoded = decodeAddress(address);
      normalizedAddress = encodeAddress(decoded, ss58Prefix);
    } catch {
      normalizedAddress = address;
    }

    // Check Redis cache first
    const cacheKey = cacheKeys.identity(normalizedAddress, chain);
    const cached = await cacheGet<Awaited<ReturnType<typeof this.getIdentity>>>(cacheKey);
    if (cached) {
      return { ...cached, address };
    }

    // Check DB for bulk-synced data (< 24h old)
    const identitySource = getIdentitySource(chain);
    const dbIdentity = await prisma.identity.findUnique({
      where: { address_source: { address: normalizedAddress, source: identitySource } },
    });

    if (dbIdentity && dbIdentity.lastSyncedAt) {
      const ageMs = Date.now() - dbIdentity.lastSyncedAt.getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        const result = {
          address,
          chain,
          hasIdentity: dbIdentity.hasIdentity,
          isVerified: dbIdentity.isVerified,
          identity: dbIdentity.hasIdentity ? {
            displayName: dbIdentity.displayName,
            legalName: dbIdentity.legalName,
            email: dbIdentity.email,
            twitter: dbIdentity.twitter,
            web: dbIdentity.web,
            riot: dbIdentity.riot,
            github: dbIdentity.github,
            discord: dbIdentity.discord,
            matrix: dbIdentity.matrix,
          } : null,
          judgements: Array.isArray(dbIdentity.judgements)
            ? (dbIdentity.judgements as Array<{ registrarId: number; judgement: string }>)
            : [],
        };
        await cacheSet(cacheKey, result, IDENTITY_CACHE_TTL);
        return result;
      }
    }

    // Fallback: fetch from People Chain RPC
    try {
      const api = await this.getPeopleChainClient(chain);

      if (!api.query.identity?.identityOf) {
        throw new Error(`Identity pallet not available on ${chain} People chain`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const identityOf = await api.query.identity.identityOf(normalizedAddress) as any;

      if (identityOf.isNone) {
        const noIdentityResult = {
          address,
          chain,
          hasIdentity: false,
          isVerified: false,
          identity: null,
          judgements: [] as Array<{ registrarId: number; judgement: string }>,
        };
        await cacheSet(cacheKey, noIdentityResult, IDENTITY_CACHE_TTL);
        return noIdentityResult;
      }

      const identityData = identityOf.unwrap();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = identityData as any;
      const registration = Array.isArray(rawData) ? rawData[0] : rawData;

      // Import parseRegistration from identity-sync service would create circular dep,
      // so we inline the parsing here using the shared parseField utility
      const { identityInfo, judgements, isVerified, additional } = parseRegistrationData(registration);

      // Upsert to DB
      const chainRecord = await prisma.chain.findUnique({ where: { code: getChainCode(chain) } });
      if (chainRecord) {
        await prisma.identity.upsert({
          where: { address_source: { address: normalizedAddress, source: identitySource } },
          create: {
            address: normalizedAddress,
            source: identitySource,
            chainId: chainRecord.id,
            ...identityInfo,
            twitter: normalizeTwitter(identityInfo.twitter),
            web: normalizeWeb(identityInfo.web),
            github: normalizeGithub(additional.github),
            discord: additional.discord,
            matrix: additional.matrix,
            additionalFields: additional.all,
            hasIdentity: true,
            isVerified,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            judgements: judgements as any,
            lastSyncedAt: new Date(),
          },
          update: {
            ...identityInfo,
            twitter: normalizeTwitter(identityInfo.twitter),
            web: normalizeWeb(identityInfo.web),
            github: normalizeGithub(additional.github),
            discord: additional.discord,
            matrix: additional.matrix,
            additionalFields: additional.all,
            hasIdentity: true,
            isVerified,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            judgements: judgements as any,
            lastSyncedAt: new Date(),
          },
        });
      }

      const result = {
        address,
        chain,
        hasIdentity: true,
        isVerified,
        identity: {
          ...identityInfo,
          github: additional.github,
          discord: additional.discord,
          matrix: additional.matrix,
        },
        judgements,
      };

      await cacheSet(cacheKey, result, IDENTITY_CACHE_TTL);
      return result;
    } catch (error) {
      console.error('Failed to fetch identity:', error);
      throw error;
    }
  }
}

/**
 * Parse a registration from the identity pallet.
 * Shared inline function (avoids circular dependency with identity-sync service).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRegistrationData(registration: any) {
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

  // Parse additional fields (github, discord, matrix, etc.)
  const additional = parseAdditionalFields(info.additional);

  return { identityInfo, judgements, isVerified, additional };
}

/**
 * Parse info.additional Vec<[Data, Data]> key-value tuples.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAdditionalFields(additional: any): {
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
    // additional is a Vec of tuples - iterate via forEach or array conversion
    const entries = additional.toHuman ? additional.toHuman() : additional;
    if (!Array.isArray(entries)) return { github, discord, matrix, all };

    for (const tuple of entries) {
      if (!Array.isArray(tuple) || tuple.length < 2) continue;

      // Each entry is [{ Raw: key }, { Raw: value }] in human format
      const rawKey = typeof tuple[0] === 'object' ? tuple[0]?.Raw : tuple[0];
      const rawValue = typeof tuple[1] === 'object' ? tuple[1]?.Raw : tuple[1];

      const key = typeof rawKey === 'string' ? rawKey.toLowerCase().trim() : null;
      const value = typeof rawValue === 'string' ? rawValue.trim() : null;

      if (!key || !value) continue;

      all[key] = value;

      if (key === 'github' || key === 'gh') {
        github = value;
      } else if (key === 'discord') {
        discord = value;
      } else if (key === 'matrix' || key === 'element') {
        matrix = value;
      }
    }
  } catch (err) {
    console.error('[PolkadotService] Error parsing additional fields:', err);
  }

  return { github, discord, matrix, all };
}
