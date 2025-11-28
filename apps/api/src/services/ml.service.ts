/**
 * ML Service - Polkadot Address Risk Scoring
 *
 * This service provides rule-based risk analysis for Polkadot/Kusama addresses.
 * Uses heuristics based on on-chain behavior patterns to assess risk.
 *
 * Risk Scoring Philosophy:
 * - Start at 50 (neutral/unknown)
 * - Risk factors push score UP (towards 100)
 * - Trust factors push score DOWN (towards 0)
 * - Final score clamped to 0-100
 */

export interface MLFeatures {
  // Account metadata
  accountAgeHours: number;
  hasIdentity: boolean;

  // Transaction patterns
  totalTransactions: number;
  avgTransactionsPerDay: number;
  uniqueCounterparties: number;
  inboundOutboundRatio: number;

  // Value patterns
  avgTransactionValue: number;
  maxTransactionValue: number;
  totalVolumeUsd: number;

  // Timing patterns
  avgTimeBetweenTx: number;
  hasRegularPattern: boolean;
  isActiveNow: boolean;

  // Risk indicators
  knownFraudInteractions: number;
  exchangeInteractions: number;
  dustTransactions: number;
}

export interface MLAnalysis {
  // ML prediction result
  available: boolean;
  riskScore: number | null; // 0-100
  confidence: number | null; // 0-1
  topFeatures: Array<{
    name: string;
    importance: number;
    value: number | string;
  }>;
  recommendation: 'safe' | 'review' | 'high_risk' | null;

  // Feature extraction metadata
  featuresExtracted: boolean;
  features?: Partial<MLFeatures>;
  extractionError?: string;
}

interface RiskFactor {
  name: string;
  score: number; // Positive = risky, Negative = trustworthy
  importance: number; // 0-1, how much this factor matters
  value: number | string;
}

export class MLService {
  /**
   * Get risk score for a Polkadot/Kusama address using rule-based heuristics
   */
  async getAddressRiskScore(
    _address: string,
    _chain: 'polkadot' | 'kusama',
    features?: Partial<MLFeatures>
  ): Promise<MLAnalysis> {
    // No features = can't analyze
    if (!features) {
      return {
        available: false,
        riskScore: null,
        confidence: null,
        topFeatures: [],
        recommendation: null,
        featuresExtracted: false,
        extractionError: 'No features available for analysis',
      };
    }

    // Calculate risk using heuristics
    const { score, factors } = this.calculateRiskScore(features);

    // Calculate confidence based on data completeness
    const confidence = this.calculateConfidence(features);

    // Sort factors by absolute importance
    const topFeatures = factors
      .sort((a, b) => Math.abs(b.score * b.importance) - Math.abs(a.score * a.importance))
      .slice(0, 5)
      .map((f) => ({
        name: f.name,
        importance: f.importance,
        value: f.value,
      }));

    return {
      available: true,
      riskScore: score,
      confidence,
      topFeatures,
      recommendation: this.scoreToRecommendation(score),
      featuresExtracted: true,
      features,
    };
  }

  /**
   * Calculate risk score using weighted heuristics
   */
  private calculateRiskScore(features: Partial<MLFeatures>): {
    score: number;
    factors: RiskFactor[];
  } {
    const factors: RiskFactor[] = [];
    let baseScore = 50; // Start neutral

    // === ACCOUNT AGE ===
    const ageHours = features.accountAgeHours ?? 0;
    if (ageHours > 0) {
      if (ageHours < 24) {
        // Very new account - HIGH RISK
        factors.push({
          name: 'New account (< 24h)',
          score: 30,
          importance: 0.9,
          value: `${ageHours.toFixed(1)} hours`,
        });
      } else if (ageHours < 168) {
        // < 1 week - moderate risk
        factors.push({
          name: 'Recent account (< 1 week)',
          score: 15,
          importance: 0.7,
          value: `${(ageHours / 24).toFixed(1)} days`,
        });
      } else if (ageHours < 720) {
        // < 1 month - slight risk
        factors.push({
          name: 'Account < 1 month old',
          score: 5,
          importance: 0.4,
          value: `${(ageHours / 24).toFixed(0)} days`,
        });
      } else if (ageHours > 8760) {
        // > 1 year - trustworthy
        factors.push({
          name: 'Established account (> 1 year)',
          score: -15,
          importance: 0.8,
          value: `${(ageHours / 8760).toFixed(1)} years`,
        });
      } else if (ageHours > 4380) {
        // > 6 months - somewhat trustworthy
        factors.push({
          name: 'Account > 6 months old',
          score: -8,
          importance: 0.6,
          value: `${(ageHours / 720).toFixed(1)} months`,
        });
      }
    }

    // === ON-CHAIN IDENTITY ===
    if (features.hasIdentity !== undefined) {
      if (features.hasIdentity) {
        factors.push({
          name: 'Has on-chain identity',
          score: -20,
          importance: 0.95,
          value: 'Yes',
        });
      } else {
        factors.push({
          name: 'No on-chain identity',
          score: 10,
          importance: 0.5,
          value: 'No',
        });
      }
    }

    // === TRANSACTION VOLUME ===
    const txCount = features.totalTransactions ?? 0;
    if (txCount > 0) {
      if (txCount < 3) {
        // Very few transactions
        factors.push({
          name: 'Minimal transaction history',
          score: 15,
          importance: 0.6,
          value: `${txCount} transactions`,
        });
      } else if (txCount > 100) {
        // Active account
        factors.push({
          name: 'Active transaction history',
          score: -10,
          importance: 0.7,
          value: `${txCount} transactions`,
        });
      } else if (txCount > 20) {
        // Moderate activity
        factors.push({
          name: 'Moderate activity',
          score: -5,
          importance: 0.5,
          value: `${txCount} transactions`,
        });
      }
    }

    // === COUNTERPARTY DIVERSITY ===
    const counterparties = features.uniqueCounterparties ?? 0;
    if (counterparties > 0 && txCount > 0) {
      const diversityRatio = counterparties / txCount;

      if (diversityRatio < 0.1 && txCount > 10) {
        // Few counterparties, many transactions = cycling funds
        factors.push({
          name: 'Low counterparty diversity',
          score: 25,
          importance: 0.85,
          value: `${counterparties} unique / ${txCount} tx`,
        });
      } else if (diversityRatio > 0.5) {
        // High diversity = organic activity
        factors.push({
          name: 'High counterparty diversity',
          score: -10,
          importance: 0.7,
          value: `${counterparties} unique addresses`,
        });
      }
    }

    // === TRANSACTION PATTERNS (BOT DETECTION) ===
    if (features.hasRegularPattern !== undefined) {
      if (features.hasRegularPattern) {
        factors.push({
          name: 'Regular timing pattern (potential bot)',
          score: 20,
          importance: 0.8,
          value: 'Detected',
        });
      }
    }

    // === TRANSACTION FREQUENCY ===
    const avgTxPerDay = features.avgTransactionsPerDay ?? 0;
    if (avgTxPerDay > 50) {
      // Extremely high frequency - likely automated
      factors.push({
        name: 'Very high transaction frequency',
        score: 15,
        importance: 0.7,
        value: `${avgTxPerDay.toFixed(1)} tx/day`,
      });
    }

    // === DUST TRANSACTIONS ===
    const dustCount = features.dustTransactions ?? 0;
    const dustRatio = txCount > 0 ? dustCount / txCount : 0;
    if (dustRatio > 0.5 && dustCount > 5) {
      // Many dust transactions - spam/attack
      factors.push({
        name: 'High dust transaction ratio',
        score: 20,
        importance: 0.75,
        value: `${(dustRatio * 100).toFixed(0)}% dust`,
      });
    } else if (dustCount > 0 && dustRatio > 0.2) {
      factors.push({
        name: 'Some dust transactions',
        score: 8,
        importance: 0.4,
        value: `${dustCount} dust tx`,
      });
    }

    // === INBOUND/OUTBOUND RATIO ===
    const ratio = features.inboundOutboundRatio ?? 1;
    if (ratio > 10) {
      // Mostly receives, rarely sends - could be collection address
      factors.push({
        name: 'High inbound ratio (collection pattern)',
        score: 15,
        importance: 0.6,
        value: `${ratio.toFixed(1)}:1 in/out`,
      });
    } else if (ratio < 0.1 && txCount > 5) {
      // Mostly sends, rarely receives - distribution/drain pattern
      factors.push({
        name: 'High outbound ratio (distribution pattern)',
        score: 20,
        importance: 0.7,
        value: `1:${(1 / ratio).toFixed(1)} in/out`,
      });
    }

    // === RECENT ACTIVITY ===
    if (features.isActiveNow !== undefined) {
      if (features.isActiveNow && ageHours > 720) {
        // Old account that's still active - good sign
        factors.push({
          name: 'Recently active established account',
          score: -5,
          importance: 0.4,
          value: 'Active in last 7 days',
        });
      }
    }

    // === KNOWN FRAUD INTERACTIONS ===
    const fraudInteractions = features.knownFraudInteractions ?? 0;
    if (fraudInteractions > 0) {
      factors.push({
        name: 'Interacted with known fraud addresses',
        score: 35,
        importance: 0.95,
        value: `${fraudInteractions} interactions`,
      });
    }

    // === EXCHANGE INTERACTIONS ===
    const exchangeInteractions = features.exchangeInteractions ?? 0;
    if (exchangeInteractions > 0) {
      factors.push({
        name: 'Exchange interactions',
        score: -8,
        importance: 0.5,
        value: `${exchangeInteractions} interactions`,
      });
    }

    // Calculate final score
    let totalAdjustment = 0;
    for (const factor of factors) {
      totalAdjustment += factor.score * factor.importance;
    }

    // Clamp to 0-100
    const finalScore = Math.max(0, Math.min(100, baseScore + totalAdjustment));

    return { score: Math.round(finalScore), factors };
  }

  /**
   * Calculate confidence based on data completeness
   */
  private calculateConfidence(features: Partial<MLFeatures>): number {
    const importantFields: (keyof MLFeatures)[] = [
      'accountAgeHours',
      'hasIdentity',
      'totalTransactions',
      'uniqueCounterparties',
      'hasRegularPattern',
      'dustTransactions',
    ];

    let available = 0;
    for (const field of importantFields) {
      if (features[field] !== undefined) {
        available++;
      }
    }

    // Base confidence on data completeness
    const completeness = available / importantFields.length;

    // Also factor in transaction count - more data = higher confidence
    const txBoost =
      features.totalTransactions !== undefined
        ? Math.min(0.2, features.totalTransactions / 500)
        : 0;

    return Math.min(1, completeness * 0.8 + txBoost + 0.1);
  }

  /**
   * Convert risk score to recommendation
   */
  private scoreToRecommendation(
    score: number | null
  ): 'safe' | 'review' | 'high_risk' | null {
    if (score === null) return null;
    if (score < 30) return 'safe';
    if (score < 70) return 'review';
    return 'high_risk';
  }

  /**
   * Check if ML service is available (always true for rule-based)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }
}
