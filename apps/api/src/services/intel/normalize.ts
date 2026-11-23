import { compare, valid } from 'semver';
import { asRecord, normalizePackageName } from './inventory';
import type { IntelAdvisory, IntelMatch, IntelSeverity, InventoryPackage } from './types';

const rank: Record<IntelSeverity, number> = { unknown: 0, low: 1, medium: 2, high: 3, critical: 4 };

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function date(value: unknown): string {
  const raw = text(value);
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : '';
}

function url(value: unknown): string | undefined {
  try {
    const parsed = new URL(text(value));
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export function severityFromScore(score: number | null): IntelSeverity {
  return score === null
    ? 'unknown'
    : score >= 9
      ? 'critical'
      : score >= 7
        ? 'high'
        : score >= 4
          ? 'medium'
          : 'low';
}

/** CVSS v3 base score. v4 vectors remain unscored unless a source supplies a numeric score. */
export function cvss3Score(vector: string): number | null {
  if (!/^CVSS:3\.[01]\//.test(vector)) return null;
  const metrics: Record<string, string | undefined> = Object.fromEntries(
    vector
      .split('/')
      .slice(1)
      .map((part) => part.split(':')),
  );
  const avWeights: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
  const acWeights: Record<string, number> = { L: 0.77, H: 0.44 };
  const uiWeights: Record<string, number> = { N: 0.85, R: 0.62 };
  const av = avWeights[metrics.AV ?? ''];
  const ac = acWeights[metrics.AC ?? ''];
  const ui = uiWeights[metrics.UI ?? ''];
  const changed = metrics.S === 'C';
  if (!['U', 'C'].includes(metrics.S ?? '')) return null;
  const prWeights: Record<string, number> = changed
    ? { N: 0.85, L: 0.68, H: 0.5 }
    : { N: 0.85, L: 0.62, H: 0.27 };
  const pr = prWeights[metrics.PR ?? ''];
  const impactValues: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };
  const c = impactValues[metrics.C ?? ''];
  const i = impactValues[metrics.I ?? ''];
  const a = impactValues[metrics.A ?? ''];
  if ([av, ac, ui, pr, c, i, a].some((value) => value === undefined)) return null;
  const iss = 1 - (1 - c!) * (1 - i!) * (1 - a!);
  // Base scoring uses the same changed-scope equation for CVSS v3.0 and v3.1.
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
  if (impact <= 0) return 0;
  const exploitability = 8.22 * av! * ac! * pr! * ui!;
  const score = Math.min(changed ? 1.08 * (impact + exploitability) : impact + exploitability, 10);
  return Math.ceil((score - 1e-10) * 10) / 10;
}

function scoreFromOsv(raw: Record<string, unknown>): number | null {
  const scores = Array.isArray(raw.severity) ? raw.severity : [];
  const numeric: number[] = [];
  for (const value of scores) {
    const score = asRecord(value)?.score;
    if (typeof score === 'number' && score >= 0 && score <= 10) numeric.push(score);
    else if (typeof score === 'string') {
      const parsed = cvss3Score(score);
      if (parsed !== null) numeric.push(parsed);
    }
  }
  return numeric.length ? Math.max(...numeric) : null;
}

function sourceSeverity(value: unknown): IntelSeverity {
  const normalized = text(value).toLowerCase();
  if (normalized === 'moderate') return 'medium';
  return ['critical', 'high', 'medium', 'low'].includes(normalized)
    ? (normalized as IntelSeverity)
    : 'unknown';
}

function refs(value: unknown): IntelAdvisory['references'] {
  if (!Array.isArray(value)) return [];
  const result: IntelAdvisory['references'] = [];
  for (const entry of value) {
    const object = asRecord(entry);
    const validUrl = url(typeof entry === 'string' ? entry : object?.url);
    if (validUrl && !result.some((reference) => reference.url === validUrl)) {
      result.push({ url: validUrl, ...(object?.type ? { type: text(object.type) } : {}) });
    }
  }
  return result;
}

function displayRanges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const descriptions: string[] = [];
  for (const range of value) {
    const data = asRecord(range);
    if (!data || !Array.isArray(data.events)) continue;
    let introduced = '0';
    for (const event of data.events) {
      const item = asRecord(event);
      if (typeof item?.introduced === 'string') introduced = item.introduced;
      const end = item?.fixed ?? item?.last_affected ?? item?.limit;
      if (typeof end !== 'string') continue;
      const lower = introduced === '0' ? '' : `>=${introduced} `;
      descriptions.push(`${lower}${item?.last_affected ? '<=' : '<'}${end}`);
      introduced = '';
    }
    if (introduced)
      descriptions.push(
        introduced === '0' ? 'All versions; no fixed version specified' : `>=${introduced}`,
      );
  }
  return descriptions;
}

export function normalizeOsvAdvisory(value: unknown): IntelAdvisory | null {
  const raw = asRecord(value);
  if (!raw || typeof raw.id !== 'string' || raw.withdrawn) return null;
  const cvss = scoreFromOsv(raw);
  const dbSeverity = sourceSeverity(asRecord(raw.database_specific)?.severity);
  const affected: IntelAdvisory['affected'] = [];
  for (const item of Array.isArray(raw.affected) ? raw.affected : []) {
    const entry = asRecord(item);
    const pkg = asRecord(entry?.package);
    if (!pkg || typeof pkg.name !== 'string' || typeof pkg.ecosystem !== 'string') continue;
    affected.push({
      ecosystem: pkg.ecosystem,
      name: normalizePackageName(pkg.name, pkg.ecosystem),
      ranges: displayRanges(entry?.ranges),
    });
  }
  return {
    id: raw.id,
    aliases: Array.isArray(raw.aliases)
      ? raw.aliases.filter((alias): alias is string => typeof alias === 'string')
      : [],
    title: text(raw.summary, raw.id),
    summary: text(
      raw.details,
      text(raw.summary, 'Read the linked advisory for affected configurations and remediation.'),
    ),
    severity: dbSeverity === 'unknown' ? severityFromScore(cvss) : dbSeverity,
    cvss,
    exploited: false,
    exploitationStatus: 'unknown',
    epss: null,
    publishedAt: date(raw.published),
    modifiedAt: date(raw.modified),
    references: refs(raw.references),
    affected,
    source: 'OSV',
  };
}

export function normalizeGitHubAdvisory(value: unknown): IntelAdvisory | null {
  const raw = asRecord(value);
  if (!raw || typeof raw.ghsa_id !== 'string' || raw.withdrawn_at) return null;
  const cvssRaw = asRecord(raw.cvss)?.score;
  const cvss = typeof cvssRaw === 'number' && cvssRaw >= 0 && cvssRaw <= 10 ? cvssRaw : null;
  const affected: IntelAdvisory['affected'] = [];
  for (const item of Array.isArray(raw.vulnerabilities) ? raw.vulnerabilities : []) {
    const vulnerability = asRecord(item);
    const pkg = asRecord(vulnerability?.package);
    if (!pkg || typeof pkg.name !== 'string' || typeof pkg.ecosystem !== 'string') continue;
    const ecosystem = pkg.ecosystem === 'pip' ? 'PyPI' : pkg.ecosystem;
    affected.push({
      ecosystem,
      name: normalizePackageName(pkg.name, ecosystem),
      ranges:
        typeof vulnerability?.vulnerable_version_range === 'string'
          ? [vulnerability.vulnerable_version_range]
          : [],
      ...(typeof vulnerability?.first_patched_version === 'string'
        ? { fixedVersion: vulnerability.first_patched_version }
        : {}),
    });
  }
  const aliases = Array.isArray(raw.identifiers)
    ? raw.identifiers
        .map((identifier) => asRecord(identifier)?.value)
        .filter((id): id is string => typeof id === 'string' && id !== raw.ghsa_id)
    : [];
  if (typeof raw.cve_id === 'string' && !aliases.includes(raw.cve_id)) aliases.push(raw.cve_id);
  const references = refs(raw.references);
  const advisoryUrl = url(raw.html_url);
  if (advisoryUrl && !references.some((reference) => reference.url === advisoryUrl))
    references.unshift({ url: advisoryUrl, type: 'ADVISORY' });
  return {
    id: raw.ghsa_id,
    aliases,
    title: text(raw.summary, raw.ghsa_id),
    summary: text(raw.description, text(raw.summary)),
    severity: sourceSeverity(raw.severity),
    cvss,
    exploited: false,
    exploitationStatus: 'unknown',
    epss: null,
    publishedAt: date(raw.published_at),
    modifiedAt: date(raw.updated_at),
    references,
    affected,
    source: raw.type === 'malware' ? 'GitHub malware advisories' : 'GitHub Advisory Database',
  };
}

function compareVersions(a: string, b: string, ecosystem: string): number | null {
  if (ecosystem === 'npm') return valid(a) && valid(b) ? compare(a, b) : null;
  // Only infer a Python upgrade boundary when both releases are simple numeric versions.
  // Pre/post/dev/local/epoch ordering belongs to a full PEP 440 implementation.
  if (!/^\d+(?:\.\d+)*$/.test(a) || !/^\d+(?:\.\d+)*$/.test(b)) return null;
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

/** Select only the fix closing the interval that contains this installed package version. */
export function fixedVersionForPackage(
  rawValue: unknown,
  pkg: InventoryPackage,
): string | undefined {
  const raw = asRecord(rawValue);
  const candidates: string[] = [];
  for (const value of Array.isArray(raw?.affected) ? raw.affected : []) {
    const affected = asRecord(value);
    const affectedPackage = asRecord(affected?.package);
    if (
      !affectedPackage ||
      affectedPackage.ecosystem !== pkg.ecosystem ||
      normalizePackageName(text(affectedPackage.name), pkg.ecosystem) !== pkg.name
    )
      continue;
    for (const rangeValue of Array.isArray(affected?.ranges) ? affected.ranges : []) {
      const range = asRecord(rangeValue);
      if (
        !range ||
        !Array.isArray(range.events) ||
        !['SEMVER', 'ECOSYSTEM'].includes(text(range.type))
      )
        continue;
      let lower = '0';
      for (const eventValue of range.events) {
        const event = asRecord(eventValue);
        if (typeof event?.introduced === 'string') lower = event.introduced;
        const upper = event?.fixed ?? event?.last_affected ?? event?.limit;
        if (typeof upper !== 'string') continue;
        const afterLower = lower === '0' ? 1 : compareVersions(pkg.version, lower, pkg.ecosystem);
        const beforeUpper = compareVersions(pkg.version, upper, pkg.ecosystem);
        if (
          typeof event?.fixed === 'string' &&
          afterLower !== null &&
          afterLower >= 0 &&
          beforeUpper !== null &&
          beforeUpper < 0
        )
          candidates.push(event.fixed);
        lower = '';
      }
    }
  }
  return candidates.sort((a, b) => compareVersions(a, b, pkg.ecosystem) ?? a.localeCompare(b))[0];
}

/** CVE, GHSA and PYSEC records can describe one vulnerability; do not alert repeatedly. */
export function deduplicateAdvisories(advisories: IntelAdvisory[]): IntelAdvisory[] {
  const groups: Array<{ ids: Set<string>; values: IntelAdvisory[] }> = [];
  for (const advisory of advisories) {
    const ids = new Set([advisory.id, ...advisory.aliases]);
    const overlapping = groups.filter((group) => [...ids].some((id) => group.ids.has(id)));
    const group = { ids, values: [advisory] };
    for (const other of overlapping) {
      for (const id of other.ids) group.ids.add(id);
      group.values.push(...other.values);
      groups.splice(groups.indexOf(other), 1);
    }
    groups.push(group);
  }
  return groups.map(({ ids, values }) => {
    const ordered = values.sort(
      (a, b) =>
        (a.id.startsWith('GHSA-') ? -1 : 0) - (b.id.startsWith('GHSA-') ? -1 : 0) ||
        a.id.localeCompare(b.id),
    );
    const primary = ordered[0]!;
    const references = new Map(
      ordered.flatMap((value) => value.references).map((reference) => [reference.url, reference]),
    );
    const dates = ordered
      .map((value) => value.modifiedAt)
      .filter(Boolean)
      .sort();
    return {
      ...primary,
      aliases: [...ids].filter((id) => id !== primary.id).sort(),
      severity: ordered.reduce(
        (best, value) => (rank[value.severity] > rank[best] ? value.severity : best),
        primary.severity,
      ),
      cvss: ordered.reduce<number | null>(
        (best, value) =>
          value.cvss === null ? best : best === null ? value.cvss : Math.max(best, value.cvss),
        null,
      ),
      exploited: ordered.some((value) => value.exploited),
      epss: ordered.reduce<number | null>(
        (best, value) =>
          value.epss === null ? best : best === null ? value.epss : Math.max(best, value.epss),
        null,
      ),
      references: [...references.values()],
      modifiedAt: dates.at(-1) ?? primary.modifiedAt,
    };
  });
}

export function deduplicateMatches(matches: IntelMatch[]): IntelMatch[] {
  const packages = new Map<string, IntelMatch[]>();
  for (const match of matches) {
    const key = `${match.ecosystem}:${match.packageName}@${match.installedVersion}`;
    packages.set(key, [...(packages.get(key) ?? []), match]);
  }
  return [...packages.values()].flatMap((group) =>
    deduplicateAdvisories(group.map((match) => match.advisory)).map((advisory) => {
      const ids = new Set([advisory.id, ...advisory.aliases]);
      const matching = group.filter((match) => ids.has(match.advisory.id));
      const base = matching.find((match) => match.advisory.id === advisory.id) ?? matching[0]!;
      const versions = [
        ...new Set(
          matching
            .map((match) => match.fixedVersion)
            .filter((version): version is string => !!version),
        ),
      ];
      // Conflicting upstream fix versions need investigation rather than an arbitrary recommendation.
      return { ...base, advisory, fixedVersion: versions.length === 1 ? versions[0] : undefined };
    }),
  );
}
