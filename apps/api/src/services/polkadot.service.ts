import { DedotClient, WsProvider } from 'dedot';
import type { PolkadotApi } from '@dedot/chaintypes/polkadot';
import type { KusamaApi } from '@dedot/chaintypes/kusama';
import { prisma } from '@wisesama/database';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

// Cache TTL: 1 hour for identity lookups
const IDENTITY_CACHE_TTL = 3600;

const RPC_ENDPOINTS: Record<string, string> = {
  polkadot: process.env.POLKADOT_RPC || 'wss://rpc.polkadot.io',
  kusama: process.env.KUSAMA_RPC || 'wss://kusama-rpc.polkadot.io',
};

type ChainApi = PolkadotApi | KusamaApi;

export class PolkadotService {
  private clients: Map<string, DedotClient<ChainApi>> = new Map();

  private async getClient(chain: string): Promise<DedotClient<ChainApi>> {
    if (this.clients.has(chain)) {
      return this.clients.get(chain)!;
    }

    const endpoint = RPC_ENDPOINTS[chain];
    if (!endpoint) {
      throw new Error(`Unknown chain: ${chain}`);
    }

    const provider = new WsProvider(endpoint);

    // Create client with proper chain type
    const client = chain === 'kusama'
      ? await DedotClient.new<KusamaApi>(provider)
      : await DedotClient.new<PolkadotApi>(provider);

    this.clients.set(chain, client as DedotClient<ChainApi>);
    return client as DedotClient<ChainApi>;
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
      const client = await this.getClient(chain);

      // Query identity - dedot returns native types, no need for unwrap
      if (!client.query.identity?.identityOf) {
        throw new Error(`Identity pallet not available on ${chain}`);
      }
      const identityOf = await client.query.identity.identityOf(address);

      if (!identityOf) {
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

      // With dedot, identityOf is already unwrapped - it's a tuple [Registration, Option<Deposit>]
      const [registration] = identityOf;
      const info = registration.info;

      // Parse judgements - dedot returns native types
      const judgements = registration.judgements.map(
        ([registrarId, judgement]: [number | bigint, { type: string }]) => ({
          registrarId: Number(registrarId),
          judgement: judgement.type,
        })
      );

      // Check if verified (has at least one positive judgement)
      const isVerified = judgements.some(
        (j: { registrarId: number; judgement: string }) =>
          ['Reasonable', 'KnownGood'].includes(j.judgement)
      );

      // Parse identity data fields - dedot Data type has .value for raw data
      const parseField = (field: { type: string; value?: Uint8Array } | undefined): string | null => {
        if (field && field.type === 'Raw' && field.value) {
          return new TextDecoder().decode(field.value);
        }
        return null;
      };

      const identityData = {
        displayName: parseField(info.display as { type: string; value?: Uint8Array }),
        legalName: parseField(info.legal as { type: string; value?: Uint8Array }),
        email: parseField(info.email as { type: string; value?: Uint8Array }),
        twitter: parseField(info.twitter as { type: string; value?: Uint8Array }),
        web: parseField(info.web as { type: string; value?: Uint8Array }),
        riot: parseField(info.riot as { type: string; value?: Uint8Array }),
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
            displayName: identityData.displayName,
            legalName: identityData.legalName,
            email: identityData.email,
            twitter: identityData.twitter,
            web: identityData.web,
            riot: identityData.riot,
            hasIdentity: true,
            isVerified,
            judgements: judgementsJson,
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
