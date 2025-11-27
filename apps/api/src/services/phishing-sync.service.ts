import { prisma } from '@wisesama/database';
import type { EntityType, ThreatCategory } from '@wisesama/types';
import crypto from 'crypto';
import { decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';

const PHISHING_ADDRESS_URL = 'https://polkadot.js.org/phishing/address.json';
const PHISHING_ALL_URL = 'https://polkadot.js.org/phishing/all.json';

/**
 * HTTP Response interface matching the Fetch API.
 * Explicitly defined to avoid type conflicts with @polkadot packages
 * which export a Response type for Substrate RPC responses.
 */
interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
}

interface AddressJson {
  [threatName: string]: string[];
}

interface AllJson {
  allow: string[];
  deny: string[];
}

export class PhishingSyncService {
  /**
   * Sync phishing data from polkadot-js phishing list
   * Returns the number of new entities added
   */
  async syncPhishingList(): Promise<{ addresses: number; domains: number; total: number }> {
    console.log('[PhishingSync] Starting sync...');

    const [addressResult, domainResult] = await Promise.all([
      this.syncAddresses(),
      this.syncDomains(),
    ]);

    // Update sync state
    const contentHash = crypto
      .createHash('md5')
      .update(JSON.stringify({ addresses: addressResult, domains: domainResult }))
      .digest('hex');

    await prisma.syncState.update({
      where: { sourceName: 'polkadot-js-phishing' },
      data: {
        lastSyncAt: new Date(),
        lastSyncHash: contentHash,
        recordsProcessed: addressResult + domainResult,
        lastError: null,
      },
    });

    console.log(
      `[PhishingSync] Sync complete: ${addressResult} addresses, ${domainResult} domains`
    );

    return {
      addresses: addressResult,
      domains: domainResult,
      total: addressResult + domainResult,
    };
  }

  /**
   * Sync malicious addresses from address.json
   */
  private async syncAddresses(): Promise<number> {
    try {
      const response = (await fetch(PHISHING_ADDRESS_URL)) as HttpResponse;
      if (!response.ok) {
        throw new Error(`Failed to fetch addresses: ${response.status}`);
      }

      const data = (await response.json()) as AddressJson;
      let count = 0;

      for (const [threatName, addresses] of Object.entries(data)) {
        for (const address of addresses) {
          const normalizedAddress = this.normalizeAddress(address);
          if (!normalizedAddress) {
            console.warn(`[PhishingSync] Skipping invalid address: ${address}`);
            continue;
          }
          await this.upsertEntity({
            entityType: 'ADDRESS',
            value: address,
            normalizedValue: normalizedAddress,
            threatName,
            threatCategory: this.categorizeThreat(threatName),
            source: 'polkadot-js-phishing',
            sourceUrl: threatName.includes('.') ? `https://${threatName}` : undefined,
          });
          count++;
        }
      }

      console.log(`[PhishingSync] Synced ${count} addresses`);
      return count;
    } catch (error) {
      console.error('[PhishingSync] Address sync error:', error);
      await this.recordError(String(error));
      return 0;
    }
  }

  /**
   * Sync malicious domains from all.json
   */
  private async syncDomains(): Promise<number> {
    try {
      const response = (await fetch(PHISHING_ALL_URL)) as HttpResponse;
      if (!response.ok) {
        throw new Error(`Failed to fetch domains: ${response.status}`);
      }

      const data = (await response.json()) as AllJson;
      let count = 0;

      // Process deny list (malicious domains)
      for (const domain of data.deny) {
        const normalized = this.normalizeDomain(domain);
        await this.upsertEntity({
          entityType: 'DOMAIN',
          value: domain,
          normalizedValue: normalized,
          threatName: domain,
          threatCategory: 'PHISHING',
          source: 'polkadot-js-phishing',
          sourceUrl: `https://${domain}`,
        });
        count++;
      }

      // Process allow list (add as whitelisted if not already)
      for (const domain of data.allow) {
        const normalized = this.normalizeDomain(domain);

        // Check if already in whitelist
        const existing = await prisma.whitelistedEntity.findUnique({
          where: {
            entityType_normalizedValue: {
              entityType: 'DOMAIN',
              normalizedValue: normalized,
            },
          },
        });

        if (!existing) {
          await prisma.whitelistedEntity.create({
            data: {
              entityType: 'DOMAIN',
              value: domain,
              normalizedValue: normalized,
              name: domain,
              category: 'verified',
              source: 'polkadot-js-phishing-allow',
              verifiedAt: new Date(),
            },
          });
        }
      }

      console.log(`[PhishingSync] Synced ${count} domains (${data.allow.length} allow-listed)`);
      return count;
    } catch (error) {
      console.error('[PhishingSync] Domain sync error:', error);
      await this.recordError(String(error));
      return 0;
    }
  }

  /**
   * Upsert an entity into the database
   */
  private async upsertEntity(data: {
    entityType: EntityType;
    value: string;
    normalizedValue: string;
    threatName: string;
    threatCategory: ThreatCategory;
    source: string;
    sourceUrl?: string;
  }) {
    await prisma.entity.upsert({
      where: {
        entityType_normalizedValue: {
          entityType: data.entityType,
          normalizedValue: data.normalizedValue,
        },
      },
      update: {
        threatName: data.threatName,
        threatCategory: data.threatCategory,
        sourceUrl: data.sourceUrl,
        riskLevel: 'FRAUD',
        riskScore: 95,
        updatedAt: new Date(),
      },
      create: {
        entityType: data.entityType,
        value: data.value,
        normalizedValue: data.normalizedValue,
        threatName: data.threatName,
        threatCategory: data.threatCategory,
        source: data.source,
        sourceUrl: data.sourceUrl,
        riskLevel: 'FRAUD',
        riskScore: 95,
        firstReportedAt: new Date(),
      },
    });
  }

  /**
   * Normalize an address to hex public key for chain-agnostic lookup
   * This matches the normalization in entity-detector.ts
   * Using hex ensures the same address matches regardless of SS58 prefix
   * (Polkadot, Kusama, Astar, etc. all resolve to the same hex)
   * See: https://forum.polkadot.network/t/unifying-polkadot-ecosystem-address-format/10042
   */
  private normalizeAddress(address: string): string | null {
    try {
      const decoded = decodeAddress(address);
      return u8aToHex(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Normalize a domain for consistent lookup
   */
  private normalizeDomain(domain: string): string {
    return (domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]) ?? '';
  }

  /**
   * Categorize threat based on threat name patterns
   */
  private categorizeThreat(threatName: string): ThreatCategory {
    const lowerName = threatName.toLowerCase();

    if (lowerName.includes('airdrop') || lowerName.includes('drop')) {
      return 'FAKE_AIRDROP';
    }
    if (lowerName.includes('scam')) {
      return 'SCAM';
    }
    if (lowerName.includes('rug') || lowerName.includes('pull')) {
      return 'RUG_PULL';
    }
    if (lowerName.includes('impersonat')) {
      return 'IMPERSONATION';
    }

    // Default to phishing for domain-like threats
    return 'PHISHING';
  }

  /**
   * Record sync error to database
   */
  private async recordError(error: string) {
    await prisma.syncState.update({
      where: { sourceName: 'polkadot-js-phishing' },
      data: {
        lastError: error,
      },
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus() {
    return prisma.syncState.findUnique({
      where: { sourceName: 'polkadot-js-phishing' },
    });
  }

  /**
   * Get entity counts
   */
  async getEntityCounts() {
    const [addresses, domains, whitelisted] = await Promise.all([
      prisma.entity.count({ where: { entityType: 'ADDRESS' } }),
      prisma.entity.count({ where: { entityType: 'DOMAIN' } }),
      prisma.whitelistedEntity.count(),
    ]);

    return { addresses, domains, whitelisted, total: addresses + domains };
  }
}

export const phishingSyncService = new PhishingSyncService();
