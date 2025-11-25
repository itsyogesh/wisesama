import { prisma } from '@wisesama/database';
import type { CheckResponse, RiskLevel, EntityType } from '@wisesama/types';
import { detectEntityType, normalizeEntity } from '../utils/entity-detector';
import { LevenshteinService } from './levenshtein.service';
import { PolkadotService } from './polkadot.service';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

const levenshteinService = new LevenshteinService();
const polkadotService = new PolkadotService();

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes

export class QueryService {
  async checkEntity(input: string): Promise<CheckResponse> {
    const { type, normalized, chain } = detectEntityType(input);

    // Check cache first
    const cacheKey = cacheKeys.entity(type, normalized);
    const cached = await cacheGet<CheckResponse>(cacheKey);
    if (cached) {
      // Update stats in background (don't wait)
      this.recordSearch(input, normalized, type, cached.stats.timesSearched > 0 ? 'cached' : null);
      return { ...cached, stats: { ...cached.stats, timesSearched: cached.stats.timesSearched + 1 } };
    }

    // Look up in database
    const entity = await prisma.entity.findUnique({
      where: {
        entityType_normalizedValue: {
          entityType: type,
          normalizedValue: normalized,
        },
      },
    });

    // Check whitelist
    const whitelisted = await prisma.whitelistedEntity.findUnique({
      where: {
        entityType_normalizedValue: {
          entityType: type,
          normalizedValue: normalized,
        },
      },
    });

    // Check for look-alike (impersonation) if it's a Twitter handle
    let lookAlike = undefined;
    if (type === 'TWITTER') {
      lookAlike = await levenshteinService.checkImpersonation(normalized, 'twitter');
    }

    // Fetch on-chain identity for addresses
    let identityData: {
      hasIdentity: boolean;
      isVerified: boolean;
      displayName?: string | null;
      judgements?: Array<{ registrarId: number; judgement: string }>;
    } = { hasIdentity: false, isVerified: false };

    if (type === 'ADDRESS' && chain) {
      try {
        const chainName = chain === 'dot' ? 'polkadot' : chain === 'ksm' ? 'kusama' : null;
        if (chainName) {
          const identity = await polkadotService.getIdentity(normalized, chainName);
          identityData = {
            hasIdentity: identity.hasIdentity,
            isVerified: identity.isVerified,
            displayName: identity.identity?.displayName,
            judgements: identity.judgements,
          };
        }
      } catch (error) {
        console.error('Failed to fetch identity for address:', error);
      }
    }

    // Update search stats
    if (entity) {
      await prisma.entity.update({
        where: { id: entity.id },
        data: {
          timesSearched: { increment: 1 },
          lastSearchedAt: new Date(),
        },
      });
    }

    // Record the search
    this.recordSearch(input, normalized, type, entity?.id || null);

    // Calculate risk
    const assessment = this.calculateRisk(entity, whitelisted, lookAlike, identityData);

    const response: CheckResponse = {
      entity: input,
      entityType: type,
      chain: chain || undefined,
      assessment,
      blacklist: {
        found: entity?.source === 'polkadot-js-phishing' || false,
        source: entity?.source,
        threatName: entity?.threatName || undefined,
      },
      whitelist: {
        found: !!whitelisted,
        name: whitelisted?.name,
        category: whitelisted?.category,
      },
      identity: {
        hasIdentity: identityData.hasIdentity,
        isVerified: identityData.isVerified,
        displayName: identityData.displayName,
        judgements: identityData.judgements,
      },
      lookAlike,
      stats: {
        timesSearched: entity?.timesSearched || 1,
        userReports: entity?.userReportCount || 0,
        lastSearched: entity?.lastSearchedAt || new Date(),
      },
    };

    // Cache the response
    await cacheSet(cacheKey, response, CACHE_TTL);

    return response;
  }

  private async recordSearch(
    searchTerm: string,
    normalizedTerm: string,
    entityType: EntityType,
    entityId: string | null
  ) {
    try {
      await prisma.search.create({
        data: {
          searchTerm,
          normalizedTerm,
          entityType,
          entityId,
          cacheHit: entityId === 'cached',
        },
      });
    } catch (error) {
      console.error('Failed to record search:', error);
    }
  }

  private calculateRisk(
    entity: { riskLevel: RiskLevel; source: string; userReportCount: number } | null,
    whitelisted: { name: string } | null,
    lookAlike: { isLookAlike: boolean; similarity?: number } | undefined,
    identity: { hasIdentity: boolean; isVerified: boolean } = { hasIdentity: false, isVerified: false }
  ) {
    // 1. Whitelisted = SAFE
    if (whitelisted) {
      return {
        riskLevel: 'SAFE' as RiskLevel,
        riskScore: 5,
        threatCategory: null,
      };
    }

    // 2. Blacklisted = FRAUD
    if (entity?.source === 'polkadot-js-phishing') {
      return {
        riskLevel: 'FRAUD' as RiskLevel,
        riskScore: 95,
        threatCategory: 'PHISHING' as const,
      };
    }

    // 3. Look-alike = CAUTION
    if (lookAlike?.isLookAlike && lookAlike.similarity && lookAlike.similarity > 0.7) {
      return {
        riskLevel: 'CAUTION' as RiskLevel,
        riskScore: 70,
        threatCategory: 'IMPERSONATION' as const,
      };
    }

    // 4. Multiple user reports = CAUTION
    if (entity && entity.userReportCount >= 3) {
      return {
        riskLevel: 'CAUTION' as RiskLevel,
        riskScore: 60,
        threatCategory: null,
      };
    }

    // 5. Verified on-chain identity = LOW_RISK (trusted but not whitelisted)
    if (identity.isVerified) {
      return {
        riskLevel: 'LOW_RISK' as RiskLevel,
        riskScore: 20,
        threatCategory: null,
      };
    }

    // 6. Has identity but not verified = slightly better than unknown
    if (identity.hasIdentity) {
      return {
        riskLevel: 'UNKNOWN' as RiskLevel,
        riskScore: 40,
        threatCategory: null,
      };
    }

    // 7. Unknown
    return {
      riskLevel: 'UNKNOWN' as RiskLevel,
      riskScore: null,
      threatCategory: null,
    };
  }
}
