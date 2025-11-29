import { ApiPromise, WsProvider } from '@polkadot/api';
import { hexToString } from '@polkadot/util';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { prisma } from '@wisesama/database';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

// SS58 prefixes for each chain (for address normalization)
const SS58_PREFIXES: Record<string, number> = {
  polkadot: 0,
  kusama: 2,
};

// Cache TTL: 1 hour for identity lookups
const IDENTITY_CACHE_TTL = 3600;

// Normalization functions for reverse lookup indexes
function normalizeTwitter(handle: string | null): string | null {
  if (!handle) return null;
  return handle.toLowerCase().replace(/^@/, '').trim() || null;
}

function normalizeWeb(url: string | null): string | null {
  if (!url) return null;
  const parts = url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/');
  const domain = parts[0]?.trim();
  return domain || null;
}

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
   * Get People chain client for identity queries
   * Identity pallet has been migrated from relay chains to People parachains
   */
  private async getPeopleChainClient(chain: string): Promise<ApiPromise> {
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
    } | null;
    judgements: Array<{ registrarId: number; judgement: string }>;
  }> {
    // Normalize address to chain-specific format for consistent caching
    // This ensures addresses like 5Dnj... (substrate) and 12j2... (polkadot)
    // are treated as the same account
    const ss58Prefix = SS58_PREFIXES[chain] ?? 0;
    let normalizedAddress: string;
    try {
      const decoded = decodeAddress(address);
      normalizedAddress = encodeAddress(decoded, ss58Prefix);
    } catch {
      // If decoding fails, use original address
      normalizedAddress = address;
    }

    // Check Redis cache first (using normalized address)
    const cacheKey = cacheKeys.identity(normalizedAddress, chain);
    const cached = await cacheGet<Awaited<ReturnType<typeof this.getIdentity>>>(cacheKey);
    if (cached) {
      // Return with original address for consistency with input
      return { ...cached, address };
    }

    try {
      // Use People chain for identity queries (identity migrated from relay chains)
      const api = await this.getPeopleChainClient(chain);

      // Query identity - check if identity pallet exists
      if (!api.query.identity || !api.query.identity.identityOf) {
        throw new Error(`Identity pallet not available on ${chain} People chain`);
      }

      // Query using normalized address for consistent results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const identityOf = await api.query.identity.identityOf(normalizedAddress) as any;

      if (identityOf.isNone) {
        const noIdentityResult = {
          address,
          chain,
          hasIdentity: false,
          isVerified: false,
          identity: null,
          judgements: [],
        };
        // Cache the no-identity result
        await cacheSet(cacheKey, noIdentityResult, IDENTITY_CACHE_TTL);
        return noIdentityResult;
      }

      // Unwrap the Option - returns [Registration, Option<Deposit>] tuple or just Registration
      const identityData = identityOf.unwrap();

      // Handle both tuple and direct registration formats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = identityData as any;
      const registration = Array.isArray(rawData) ? rawData[0] : rawData;
      const info = registration.info;

      // Parse judgements
      const judgements = registration.judgements.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => {
          const [registrarId, judgement] = item;
          return {
            registrarId: Number(registrarId.toString()),
            judgement: judgement.type || judgement.toString(),
          };
        }
      );

      // Check if verified (has at least one positive judgement)
      const isVerified = judgements.some(
        (j: { registrarId: number; judgement: string }) =>
          ['Reasonable', 'KnownGood'].includes(j.judgement)
      );

      // Parse identity data fields - handle Raw hex data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseField = (field: any): string | null => {
        if (!field) return null;

        // Check if it's a Raw type with hex data
        if (field.isRaw && field.asRaw?.toHex) {
          const hex = field.asRaw.toHex();
          if (hex && hex !== '0x') {
            return hexToString(hex);
          }
        }

        // Try toHuman() for human-readable format
        if (field.toHuman) {
          const human = field.toHuman();
          if (human && typeof human === 'object') {
            const humanObj = human as { Raw?: string };
            if (humanObj.Raw) {
              // Raw might be hex-encoded
              if (humanObj.Raw.startsWith('0x')) {
                return hexToString(humanObj.Raw);
              }
              return humanObj.Raw;
            }
          }
          if (typeof human === 'string' && human !== 'None') {
            return human;
          }
        }

        return null;
      };

      const identityInfo = {
        displayName: parseField(info.display),
        legalName: parseField(info.legal),
        email: parseField(info.email),
        twitter: parseField(info.twitter),
        web: parseField(info.web),
        riot: parseField(info.riot),
      };

      // Cache in database (using normalized address for consistency)
      const chainRecord = await prisma.chain.findUnique({ where: { code: getChainCode(chain) } });
      if (chainRecord) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const judgementsJson = judgements as any;
        await prisma.polkadotIdentity.upsert({
          where: {
            address_chainId: {
              address: normalizedAddress,
              chainId: chainRecord.id,
            },
          },
          create: {
            address: normalizedAddress,
            chainId: chainRecord.id,
            displayName: identityInfo.displayName,
            legalName: identityInfo.legalName,
            email: identityInfo.email,
            twitter: identityInfo.twitter,
            web: identityInfo.web,
            riot: identityInfo.riot,
            hasIdentity: true,
            isVerified,
            judgements: judgementsJson,
            lastSyncedAt: new Date(),
          },
          update: {
            displayName: identityInfo.displayName,
            legalName: identityInfo.legalName,
            email: identityInfo.email,
            twitter: identityInfo.twitter,
            web: identityInfo.web,
            riot: identityInfo.riot,
            hasIdentity: true,
            isVerified,
            judgements: judgementsJson,
            lastSyncedAt: new Date(),
          },
        });

        // Also upsert to new unified Identity table (with normalized twitter/web for reverse lookups)
        const identitySource = getIdentitySource(chain);
        await prisma.identity.upsert({
          where: {
            address_source: {
              address: normalizedAddress,
              source: identitySource,
            },
          },
          create: {
            address: normalizedAddress,
            source: identitySource,
            chainId: chainRecord.id,
            displayName: identityInfo.displayName,
            legalName: identityInfo.legalName,
            email: identityInfo.email,
            twitter: normalizeTwitter(identityInfo.twitter),
            web: normalizeWeb(identityInfo.web),
            riot: identityInfo.riot,
            hasIdentity: true,
            isVerified,
            judgements: judgementsJson,
            lastSyncedAt: new Date(),
          },
          update: {
            chainId: chainRecord.id,
            displayName: identityInfo.displayName,
            legalName: identityInfo.legalName,
            email: identityInfo.email,
            twitter: normalizeTwitter(identityInfo.twitter),
            web: normalizeWeb(identityInfo.web),
            riot: identityInfo.riot,
            hasIdentity: true,
            isVerified,
            judgements: judgementsJson,
            lastSyncedAt: new Date(),
          },
        });
      }

      const result = {
        address,
        chain,
        hasIdentity: true,
        isVerified,
        identity: identityInfo,
        judgements,
      };

      // Cache the result in Redis
      await cacheSet(cacheKey, result, IDENTITY_CACHE_TTL);

      return result;
    } catch (error) {
      console.error('Failed to fetch identity:', error);
      throw error;
    }
  }
}
