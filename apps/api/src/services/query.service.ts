import { prisma } from '@wisesama/database';
import type { CheckResponse, RiskLevel, EntityType } from '@wisesama/types';
import { detectEntityType, normalizeEntity } from '../utils/entity-detector';
import { LevenshteinService } from './levenshtein.service';

const levenshteinService = new LevenshteinService();

export class QueryService {
  async checkEntity(input: string): Promise<CheckResponse> {
    const { type, normalized, chain } = detectEntityType(input);

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
    await prisma.search.create({
      data: {
        searchTerm: input,
        normalizedTerm: normalized,
        entityType: type,
        entityId: entity?.id,
        resultRisk: entity?.riskLevel || (whitelisted ? 'SAFE' : 'UNKNOWN'),
      },
    });

    // Calculate risk
    const assessment = this.calculateRisk(entity, whitelisted, lookAlike);

    return {
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
        hasIdentity: false, // TODO: Integrate with PolkadotService
        isVerified: false,
      },
      lookAlike,
      stats: {
        timesSearched: entity?.timesSearched || 1,
        userReports: entity?.userReportCount || 0,
        lastSearched: entity?.lastSearchedAt || new Date(),
      },
    };
  }

  private calculateRisk(
    entity: { riskLevel: RiskLevel; source: string; userReportCount: number } | null,
    whitelisted: { name: string } | null,
    lookAlike: { isLookAlike: boolean; similarity?: number } | undefined
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
        threatCategory: 'PHISHING',
      };
    }

    // 3. Look-alike = CAUTION
    if (lookAlike?.isLookAlike && lookAlike.similarity && lookAlike.similarity > 0.7) {
      return {
        riskLevel: 'CAUTION' as RiskLevel,
        riskScore: 70,
        threatCategory: 'IMPERSONATION',
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

    // 5. Unknown
    return {
      riskLevel: 'UNKNOWN' as RiskLevel,
      riskScore: null,
      threatCategory: null,
    };
  }
}
