import type { RiskLevel, ThreatCategory } from './entity';

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskScore: number | null;
  threatCategory?: ThreatCategory | null;
  confidence?: number;
}

export interface BlacklistResult {
  found: boolean;
  source?: string;
  threatName?: string;
  sourceUrl?: string;
}

export interface WhitelistResult {
  found: boolean;
  name?: string;
  category?: string;
  verifiedAt?: Date;
}

export interface IdentityResult {
  hasIdentity: boolean;
  isVerified: boolean;
  displayName?: string | null;
  judgements?: Array<{
    registrarId: number;
    judgement: string;
  }>;
}

export interface LookAlikeResult {
  isLookAlike: boolean;
  possibleImpersonating?: string;
  knownHandle?: string;
  similarity?: number;
  warning?: string;
}

export interface EntityStats {
  timesSearched: number;
  userReports: number;
  lastSearched?: Date | null;
  firstReported?: Date | null;
}
