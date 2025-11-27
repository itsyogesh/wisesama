import { ApiPromise, WsProvider } from '@polkadot/api';
import { hexToString } from '@polkadot/util';
import { prisma } from '@wisesama/database';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

// Cache TTL: 1 hour for identity lookups
const IDENTITY_CACHE_TTL = 3600;

const RPC_ENDPOINTS: Record<string, string> = {
  polkadot: process.env.POLKADOT_RPC || 'wss://rpc.polkadot.io',
  kusama: process.env.KUSAMA_RPC || 'wss://kusama-rpc.polkadot.io',
};

export class PolkadotService {
  private clients: Map<string, ApiPromise> = new Map();

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

    this.clients.set(chain, api);
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
    // Check Redis cache first
    const cacheKey = cacheKeys.identity(address, chain);
    const cached = await cacheGet<Awaited<ReturnType<typeof this.getIdentity>>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const api = await this.getClient(chain);

      // Query identity - check if identity pallet exists
      if (!api.query.identity || !api.query.identity.identityOf) {
        throw new Error(`Identity pallet not available on ${chain}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const identityOf = await api.query.identity.identityOf(address) as any;

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

      // Cache in database
      const chainRecord = await prisma.chain.findUnique({ where: { code: chain.slice(0, 3) } });
      if (chainRecord) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const judgementsJson = judgements as any;
        await prisma.polkadotIdentity.upsert({
          where: {
            address_chainId: {
              address,
              chainId: chainRecord.id,
            },
          },
          create: {
            address,
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
