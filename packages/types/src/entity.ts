export type EntityType = 'ADDRESS' | 'DOMAIN' | 'TWITTER' | 'EMAIL';

export type RiskLevel = 'SAFE' | 'LOW_RISK' | 'UNKNOWN' | 'CAUTION' | 'FRAUD';

export type ThreatCategory =
  | 'PHISHING'
  | 'SCAM'
  | 'RUG_PULL'
  | 'IMPERSONATION'
  | 'FAKE_AIRDROP'
  | 'RANSOMWARE'
  | 'MIXER'
  | 'OFAC_SANCTIONED'
  | 'OTHER';

export interface Entity {
  id: string;
  entityType: EntityType;
  value: string;
  normalizedValue: string;
  chainId?: number | null;
  riskLevel: RiskLevel;
  riskScore?: number | null;
  threatCategory?: ThreatCategory | null;
  source: string;
  sourceUrl?: string | null;
  threatName?: string | null;
  timesSearched: number;
  lastSearchedAt?: Date | null;
  userReportCount: number;
  firstReportedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolkadotIdentity {
  id: string;
  address: string;
  chainId: number;
  displayName?: string | null;
  legalName?: string | null;
  email?: string | null;
  twitter?: string | null;
  web?: string | null;
  riot?: string | null;
  hasIdentity: boolean;
  isVerified: boolean;
  judgements: RegistrarJudgement[];
  lastSyncedAt?: Date | null;
}

export interface RegistrarJudgement {
  registrarId: number;
  judgement: string;
}

export interface WhitelistedEntity {
  id: string;
  entityType: EntityType;
  value: string;
  normalizedValue: string;
  chainId?: number | null;
  name: string;
  category: string;
  description?: string | null;
  website?: string | null;
  twitter?: string | null;
  logoUrl?: string | null;
  source: string;
  verifiedAt?: Date | null;
  isActive: boolean;
}
