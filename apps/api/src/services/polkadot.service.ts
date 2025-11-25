import { ApiPromise, WsProvider } from '@polkadot/api';
import { prisma } from '@wisesama/database';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

// Cache TTL: 1 hour for identity lookups
const IDENTITY_CACHE_TTL = 3600;

const RPC_ENDPOINTS: Record<string, string> = {
  polkadot: process.env.POLKADOT_RPC || 'wss://rpc.polkadot.io',
  kusama: process.env.KUSAMA_RPC || 'wss://kusama-rpc.polkadot.io',
};

export class PolkadotService {
  private apis: Map<string, ApiPromise> = new Map();

  private async getApi(chain: string): Promise<ApiPromise> {
    if (this.apis.has(chain)) {
      return this.apis.get(chain)!;
    }

    const endpoint = RPC_ENDPOINTS[chain];
    if (!endpoint) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    const provider = new WsProvider(endpoint);
    const api = await ApiPromise.create({ provider });
    this.apis.set(chain, api);
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
      const api = await this.getApi(chain);

      // Query identity
      const identityOf = await api.query.identity.identityOf(address);

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

      const identity = identityOf.unwrap();
      const info = identity[0].info;

      // Parse judgements
      const judgements = identity[0].judgements.map(([registrarId, judgement]) => ({
        registrarId: registrarId.toNumber(),
        judgement: judgement.type,
      }));

      // Check if verified (has at least one positive judgement)
      const isVerified = judgements.some((j) =>
        ['Reasonable', 'KnownGood'].includes(j.judgement)
      );

      const parseField = (field: { isRaw?: boolean; asRaw?: { toUtf8: () => string } }) => {
        if (field && 'isRaw' in field && field.isRaw && field.asRaw) {
          return field.asRaw.toUtf8();
        }
        return null;
      };

      const identityData = {
        displayName: parseField(info.display as any),
        legalName: parseField(info.legal as any),
        email: parseField(info.email as any),
        twitter: parseField(info.twitter as any),
        web: parseField(info.web as any),
        riot: parseField(info.riot as any),
      };

      // Cache in database
      const chainRecord = await prisma.chain.findUnique({ where: { code: chain.slice(0, 3) } });
      if (chainRecord) {
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
            displayName: identityData.displayName,
            legalName: identityData.legalName,
            email: identityData.email,
            twitter: identityData.twitter,
            web: identityData.web,
            riot: identityData.riot,
            hasIdentity: true,
            isVerified,
            judgements: judgements as any,
            lastSyncedAt: new Date(),
          },
          update: {
            displayName: identityData.displayName,
            legalName: identityData.legalName,
            email: identityData.email,
            twitter: identityData.twitter,
            web: identityData.web,
            riot: identityData.riot,
            hasIdentity: true,
            isVerified,
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
        identity: identityData,
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
