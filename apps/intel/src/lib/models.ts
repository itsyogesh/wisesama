export type IntelSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type FindingStatus = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'not_affected';
export type InventoryFormat = 'auto' | 'inventory' | 'package-lock' | 'pnpm-lock' | 'package-json';
export type Environment = 'production' | 'staging' | 'development';

export interface InventoryPackage {
  name: string;
  version: string;
  ecosystem: 'npm' | 'PyPI';
}

export interface InventoryInput {
  format: InventoryFormat;
  content: string;
}

export interface Runtime {
  name: string;
  version: string;
}

export interface ProjectInput {
  organizationId: string;
  name: string;
  environment: Environment;
  inventory: InventoryInput;
  runtime?: Runtime;
}

export interface IntelAdvisory {
  id: string;
  aliases: string[];
  title: string;
  summary: string;
  severity: IntelSeverity;
  cvss: number | null;
  exploited: boolean;
  exploitationStatus?: 'known_exploited' | 'not_in_kev' | 'unknown';
  exploitationCheckedAt?: string;
  epss: number | null;
  publishedAt: string;
  modifiedAt: string;
  references: Array<{ url: string; type?: string }>;
  affected: Array<{
    ecosystem: string;
    name: string;
    ranges?: string[];
    fixedVersion?: string;
  }>;
  source: string;
  editorial?: { guidance: string; reviewedAt: string | null; publisher: 'Wisesama' };
}

export interface SourceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  checkedAt: string;
  error?: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  environment: Environment;
  runtime: Runtime | null;
  packages: InventoryPackage[];
  inventoryUpdatedAt: string;
  createdAt: string;
  lastScannedAt: string | null;
  scanError: string | null;
  scanInProgress: boolean;
  sources: SourceStatus[];
  warnings: string[];
  openFindings: number;
}

export interface FindingEvent {
  id: string;
  status: FindingStatus;
  note: string;
  evidence: string;
  createdAt: string;
}

export interface Finding {
  id: string;
  projectId: string;
  projectName: string;
  advisory: IntelAdvisory;
  packageName: string;
  ecosystem: 'npm' | 'PyPI';
  installedVersion: string;
  fixedVersion: string | null;
  status: FindingStatus;
  note: string;
  evidence: string;
  verificationState: 'user_attested' | 'unverified';
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  events: FindingEvent[];
}

export interface FindingUpdate {
  status: FindingStatus;
  note?: string;
  evidence?: string;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  emailVerified: boolean;
  recipient: string;
  deliveryAvailable: boolean;
}

export interface Delivery {
  id: string;
  projectId: string | null;
  subject: string;
  channel: 'email';
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'unavailable' | 'skipped';
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  nextAttemptAt: string | null;
}

export interface Workspace {
  projects: Project[];
  findings: Finding[];
  advisories: IntelAdvisory[];
  sources: SourceStatus[];
  notificationSettings: NotificationSettings;
  deliveries: Delivery[];
  summary: {
    projects: number;
    packages: number;
    openFindings: number;
    exploitedFindings: number;
    resolvedFindings: number;
  };
}

export interface Briefings {
  advisories: IntelAdvisory[];
  sources: SourceStatus[];
  fetchedAt: string | null;
  stale: boolean;
}

export interface ScanResult {
  project: Project;
  findings: Finding[];
  sources: SourceStatus[];
  warnings: string[];
  scannedAt: string;
}

export interface InventoryResult {
  project: Project;
  warnings: string[];
}

export interface BriefingFilters {
  q?: string;
  severity?: IntelSeverity;
  exploited?: boolean;
}
