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
  twitter?: string | null;
  web?: string | null;
  riot?: string | null;
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

export interface MLAnalysisResult {
  available: boolean;
  riskScore: number | null;
  confidence: number | null;
  recommendation: 'safe' | 'review' | 'high_risk' | null;
  topFeatures?: Array<{
    name: string;
    importance: number;
    value: number | string;
  }>;
}

export interface VirusTotalResult {
  verdict: 'clean' | 'malicious' | 'suspicious' | 'unknown';
  positives: number;
  total: number;
  scanUrl: string;
  topEngines?: string[];
}

export interface TransactionSummary {
  totalTransactions: number;
  totalReceived: string;
  totalSent: string;
  currentBalance: string;
  lastActivityAt?: Date | null;
}

export interface ExternalLinks {
  blockExplorer?: string;
  virusTotal?: string;
}

// Identity source for unified identity storage
export type IdentitySource = 'POLKADOT_PEOPLE' | 'KUSAMA_PEOPLE' | 'KILT';

// Linked identity for reverse lookups (Twitter/Domain -> addresses)
export interface LinkedIdentity {
  address: string;
  chain: string; // 'polkadot' | 'kusama'
  displayName: string | null;
  isVerified: boolean;
  source: IdentitySource;
  matchedField: 'twitter' | 'web';
  judgements?: Array<{
    registrarId: number;
    judgement: string;
  }>;
}

export interface LinkedIdentitiesResult {
  found: boolean;
  count: number;
  identities: LinkedIdentity[];
  hasMore?: boolean; // If more than 10 results
}
