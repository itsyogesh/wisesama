import { prisma } from '@wisesama/database';
import type {
  CheckResponse,
  RiskLevel,
  EntityType,
  MLAnalysisResult,
  TransactionSummary,
  VirusTotalResult,
  ExternalLinks,
} from '@wisesama/types';
import { detectEntityType, normalizeEntity } from '../utils/entity-detector';
import { LevenshteinService } from './levenshtein.service';
import { PolkadotService } from './polkadot.service';
import { MLService } from './ml.service';
import { SubscanService } from './subscan.service';
import { VirusTotalService } from './virustotal.service';
import { cacheGet, cacheSet, cacheKeys } from '../lib/redis';

const levenshteinService = new LevenshteinService();
const polkadotService = new PolkadotService();
const mlService = new MLService();
const subscanService = new SubscanService();
const virusTotalService = new VirusTotalService();

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

    // ML analysis for addresses (placeholder - returns unavailable until ML server is configured)
    let mlAnalysis: MLAnalysisResult | undefined = undefined;
    let transactionSummary: TransactionSummary | undefined = undefined;
    let virusTotal: VirusTotalResult | undefined = undefined;
    let links: ExternalLinks | undefined = undefined;

    if (type === 'ADDRESS' && chain) {
      const chainName = (chain === 'dot' || chain === 'polkadot') ? 'polkadot' : (chain === 'ksm' || chain === 'kusama') ? 'kusama' : null;

      if (chainName) {
        // Fetch identity, ML analysis, and transaction summary in parallel
        const [identityResult, mlResult, txSummaryResult] = await Promise.allSettled([
          polkadotService.getIdentity(normalized, chainName),
          this.getMLAnalysis(normalized, chainName),
          subscanService.getTransactionSummary(normalized, chainName),
        ]);

        if (identityResult.status === 'fulfilled') {
          const identity = identityResult.value;
          identityData = {
            hasIdentity: identity.hasIdentity,
            isVerified: identity.isVerified,
            displayName: identity.identity?.displayName,
            judgements: identity.judgements,
          };
        } else {
          console.error('Failed to fetch identity for address:', identityResult.reason);
        }

        if (mlResult.status === 'fulfilled' && mlResult.value) {
          mlAnalysis = mlResult.value;
        }

        if (txSummaryResult.status === 'fulfilled' && txSummaryResult.value) {
          transactionSummary = txSummaryResult.value;
        }

        // If no ML result but we have identity data, create basic ML analysis
        if (!mlAnalysis && identityData) {
          mlAnalysis = await this.getMLAnalysisFromIdentity(identityData);
        }

        // Add block explorer link
        links = {
          blockExplorer: subscanService.getBlockExplorerUrl(normalized, chainName),
        };
      }
    }

    // VirusTotal scan for domains
    if (type === 'DOMAIN') {
      const vtResult = await virusTotalService.scanDomain(normalized);
      if (vtResult) {
        virusTotal = {
          verdict: vtResult.verdict,
          positives: vtResult.positives,
          total: vtResult.total,
          scanUrl: vtResult.scanUrl,
          topEngines: vtResult.topEngines,
        };
        links = {
          ...links,
          virusTotal: vtResult.scanUrl,
        };
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
      mlAnalysis,
      transactionSummary,
      virusTotal,
      links,
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

  /**
   * Get ML analysis for an address using Subscan features
   */
  private async getMLAnalysis(
    address: string,
    chain: 'polkadot' | 'kusama'
  ): Promise<MLAnalysisResult | null> {
    try {
      // Extract features from Subscan (optional, for future ML training data)
      const features = await subscanService.extractFeatures(address, chain);

      if (!features) {
        // No Subscan data available
        return null;
      }

      // Get ML prediction
      const mlResult = await mlService.getAddressRiskScore(address, chain, features);

      return {
        available: mlResult.available,
        riskScore: mlResult.riskScore,
        confidence: mlResult.confidence,
        recommendation: mlResult.recommendation,
        topFeatures: mlResult.topFeatures,
      };
    } catch (error) {
      console.error('ML analysis failed:', error);
      return null;
    }
  }

  /**
   * Get basic ML analysis using just identity data (when Subscan is unavailable)
   */
  private async getMLAnalysisFromIdentity(identityData: {
    hasIdentity: boolean;
    isVerified: boolean;
    displayName?: string | null;
  }): Promise<MLAnalysisResult> {
    // Create minimal features from identity data
    const features = {
      hasIdentity: identityData.hasIdentity,
    };

    const mlResult = await mlService.getAddressRiskScore('', 'polkadot', features);

    return {
      available: mlResult.available,
      riskScore: mlResult.riskScore,
      confidence: mlResult.confidence ? mlResult.confidence * 0.5 : null, // Lower confidence without full data
      recommendation: mlResult.recommendation,
      topFeatures: mlResult.topFeatures,
    };
  }
}
