export type InventoryEcosystem = 'npm' | 'PyPI';
export type InventoryFormat = 'auto' | 'inventory' | 'package-lock' | 'pnpm-lock' | 'package-json';

export interface InventoryPackage {
  name: string;
  version: string;
  ecosystem: InventoryEcosystem;
}

export interface ParsedInventory {
  packages: InventoryPackage[];
  warnings: string[];
  format: Exclude<InventoryFormat, 'auto'>;
}

export type IntelSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export interface IntelAdvisory {
  id: string;
  aliases: string[];
  title: string;
  summary: string;
  severity: IntelSeverity;
  cvss: number | null;
  /** Compatibility flag: true only for membership in the checked CISA KEV snapshot. */
  exploited: boolean;
  /** Not-in-KEV is not a claim that exploitation has never occurred. */
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
  /** Separately labelled human guidance; authoritative advisory data remains unchanged. */
  editorial?: { guidance: string; reviewedAt: string | null; publisher: 'Wisesama' };
}

export interface IntelMatch {
  advisory: IntelAdvisory;
  packageName: string;
  installedVersion: string;
  ecosystem: InventoryEcosystem;
  fixedVersion?: string;
}

export interface SourceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  checkedAt: string;
  error?: string;
}

export interface IntelScanResult {
  matches: IntelMatch[];
  warnings: string[];
  sources: SourceStatus[];
  scannedAt: string;
}

export interface IntelBriefingsResult {
  advisories: IntelAdvisory[];
  sources: SourceStatus[];
  fetchedAt: string;
}

export class InventoryValidationError extends Error {
  readonly code = 'INVALID_INVENTORY';

  constructor(message: string) {
    super(message);
    this.name = 'InventoryValidationError';
  }
}

export class IntelProviderError extends Error {
  readonly code = 'INTELLIGENCE_UNAVAILABLE';

  constructor(
    message: string,
    readonly source: string,
  ) {
    super(message);
    this.name = 'IntelProviderError';
  }
}
