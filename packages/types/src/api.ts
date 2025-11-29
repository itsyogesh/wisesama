import type { EntityType, RiskLevel, ThreatCategory } from './entity';
import type {
  BlacklistResult,
  EntityStats,
  ExternalLinks,
  IdentityResult,
  LinkedIdentitiesResult,
  LookAlikeResult,
  MLAnalysisResult,
  RiskAssessment,
  TransactionSummary,
  VirusTotalResult,
  WhitelistResult,
} from './risk';

// API Response wrapper
export interface ApiResponse<T> {
  meta: {
    requestId: string;
    timestamp: string;
    processingTimeMs: number;
  };
  data: T;
}

export interface ApiError {
  meta: {
    requestId: string;
    timestamp: string;
  };
  error: {
    code: string;
    message: string;
    retryAfter?: number;
  };
}

// Check endpoint response
export interface CheckResponse {
  entity: string;
  entityType: EntityType;
  chain?: string;
  assessment: RiskAssessment;
  blacklist: BlacklistResult;
  whitelist: WhitelistResult;
  identity: IdentityResult;
  lookAlike?: LookAlikeResult;
  mlAnalysis?: MLAnalysisResult;
  transactionSummary?: TransactionSummary;
  virusTotal?: VirusTotalResult;
  links?: ExternalLinks;
  stats: EntityStats;
  linkedIdentities?: LinkedIdentitiesResult;
}

// Report submission
export interface ReportSubmission {
  value: string;
  entityType: EntityType;
  threatCategory: ThreatCategory;
  otherCategory?: string;
  description?: string;
  relatedUrl?: string;
  evidenceUrls?: string[];
  reporterName?: string;
  reporterEmail?: string;
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    tier: string;
    remainingQuota: number;
  };
  accessToken: string;
  refreshToken?: string;
}

// API Key
export interface CreateApiKeyRequest {
  name?: string;
}

export interface ApiKeyResponse {
  id: string;
  keyPrefix: string;
  name?: string;
  remainingQuota: number;
  rateLimitPerMin: number;
  isActive: boolean;
  lastUsedAt?: Date | null;
  createdAt: Date;
  // Only returned on creation
  key?: string;
}

// Watch
export interface WatchAddressRequest {
  address: string;
  chain?: string;
  webhookUrl?: string;
}

export interface WatchedAddressResponse {
  id: string;
  address: string;
  chain: string;
  webhookUrl?: string;
  isActive: boolean;
  lastAlertAt?: Date | null;
  createdAt: Date;
}

// Batch check
export interface BatchCheckRequest {
  entities: string[];
}

export interface BatchCheckResponse {
  results: Array<CheckResponse | { entity: string; error: string }>;
  totalProcessed: number;
  totalFailed: number;
}
