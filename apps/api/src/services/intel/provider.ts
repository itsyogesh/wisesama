import {
  type IntelSourceId,
  type IntelSourcePolicy,
  SourceControlError,
  sourceControlService,
} from '../source-control.service';
import {
  asRecord,
  MAX_INVENTORY_PACKAGES,
  normalizePackageName,
  parseInventory,
} from './inventory';
import {
  deduplicateAdvisories,
  deduplicateMatches,
  fixedVersionForPackage,
  normalizeGitHubAdvisory,
  normalizeOsvAdvisory,
} from './normalize';
import {
  type IntelAdvisory,
  type IntelBriefingsResult,
  type IntelMatch,
  IntelProviderError,
  type IntelScanResult,
  type InventoryPackage,
  type SourceStatus,
} from './types';

export const INTEL_ENDPOINTS = {
  osvBatch: 'https://api.osv.dev/v1/querybatch',
  osvAdvisory: 'https://api.osv.dev/v1/vulns/',
  github: 'https://api.github.com/advisories',
  kev: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  epss: 'https://api.first.org/data/v1/epss',
} as const;

const USER_AGENT = 'Wisesama/1.0 (vulnerability response; https://wisesama.com)';
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/;
const OSV_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const validGitHubRecord = (value: unknown) => {
  const record = asRecord(value);
  return (
    typeof record?.ghsa_id === 'string' &&
    /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(record.ghsa_id) &&
    typeof record.summary === 'string' &&
    Array.isArray(record.vulnerabilities)
  );
};

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export interface IntelProviderOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  timeoutMs?: number;
  control?: IntelSourcePolicy;
}

export interface IntelProvider {
  scan(packages: InventoryPackage[]): Promise<IntelScanResult>;
  getBriefings(): Promise<IntelBriefingsResult>;
  clearCache(): void;
  probe(source: IntelSourceId): Promise<void>;
}

async function mapConcurrent<T, U>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const output = new Array<U>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        output[index] = await mapper(items[index]!);
      }
    }),
  );
  return output;
}

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

function readableError(error: unknown): string {
  return error instanceof IntelProviderError
    ? error.message
    : 'The source could not be checked. Try again later.';
}

/** All outbound URLs are fixed official-provider endpoints; inventory never supplies a URL. */
export function createIntelProvider(options: IntelProviderOptions = {}): IntelProvider {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());
  const cache = new Map<string, CacheEntry>();
  const pendingRequests = new Map<string, Promise<unknown>>();
  const networkAttempts = new Map<string, { at: Date; dirty: boolean }>();
  async function recordStatuses(values: SourceStatus[]) {
    if (!options.control) return;
    const groups = new Map<string, SourceStatus>();
    for (const value of values) {
      const key = value.name.startsWith('GitHub') ? 'GitHub Advisory Database' : value.name;
      if (!groups.has(key) || value.status !== 'healthy') groups.set(key, value);
    }
    for (const [name, value] of groups) {
      const attempts = [...networkAttempts.entries()]
        .filter(([key]) => key === name || (name.startsWith('GitHub') && key.startsWith('GitHub')))
        .map(([, entry]) => entry);
      const latest = attempts
        .filter((entry) => entry.dirty)
        .sort((a, b) => b.at.getTime() - a.at.getTime())[0];
      if (!latest) continue;
      await options.control.recordResult(
        name,
        value.status === 'healthy' ? 'healthy' : 'unavailable',
        value.error,
        latest.at,
      );
      for (const attempt of attempts) attempt.dirty = false;
    }
  }

  const status = (name: string, state: SourceStatus['status'], error?: string): SourceStatus => ({
    name,
    status: state,
    checkedAt: now().toISOString(),
    ...(error ? { error } : {}),
  });

  async function requestJson(
    endpoint: string,
    source: string,
    init: RequestInit = {},
    ttlMs = 0,
    force = false,
  ): Promise<unknown> {
    try {
      await options.control?.assertEnabled(source);
    } catch (error) {
      throw new IntelProviderError(
        error instanceof SourceControlError
          ? error.message
          : 'Source policy could not be checked. Previous evidence is retained.',
        source,
      );
    }
    const cacheKey = `${init.method ?? 'GET'}:${endpoint}:${typeof init.body === 'string' ? init.body : ''}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && cached.expiresAt > now().getTime()) return cached.value;
    const pending = pendingRequests.get(cacheKey);
    if (pending) return pending;
    const operation = (async () => {
      const attemptedAt = options.control ? await options.control.markAttempt(source) : now();
      networkAttempts.set(source, { at: attemptedAt, dirty: true });
      try {
        const response = await fetcher(endpoint, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
          headers: {
            Accept: endpoint.startsWith(INTEL_ENDPOINTS.github)
              ? 'application/vnd.github+json'
              : 'application/json',
            'User-Agent': USER_AGENT,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...init.headers,
          },
        });
        if (!response.ok) {
          if (response.status === 429 || response.status === 403)
            throw new IntelProviderError(
              `${source} rate-limited or rejected this request. Try again later.`,
              source,
            );
          throw new IntelProviderError(
            `${source} is unavailable (HTTP ${response.status}). Try again later.`,
            source,
          );
        }
        const declaredLength = Number(response.headers.get('content-length'));
        if (declaredLength > MAX_RESPONSE_BYTES)
          throw new IntelProviderError(`${source} returned an oversized response.`, source);
        let length = 0;
        const parts: Uint8Array[] = [];
        const reader = response.body?.getReader();
        if (!reader) throw new IntelProviderError(`${source} returned an empty response.`, source);
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > MAX_RESPONSE_BYTES) {
              await reader.cancel();
              throw new IntelProviderError(`${source} returned an oversized response.`, source);
            }
            parts.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8'));
        if (ttlMs) cache.set(cacheKey, { value, expiresAt: now().getTime() + ttlMs });
        // Bound warm-server memory rather than retaining every scanned package or advisory forever.
        if (cache.size > 1000) cache.delete(cache.keys().next().value!);
        return value;
      } catch (error) {
        if (options.control)
          await options.control.recordResult(
            source,
            'unavailable',
            readableError(error),
            attemptedAt,
          );
        if (error instanceof IntelProviderError) throw error;
        throw new IntelProviderError(`${source} could not be checked. Try again later.`, source);
      }
    })();
    pendingRequests.set(cacheKey, operation);
    try {
      return await operation;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }

  async function enrich(
    advisories: IntelAdvisory[],
  ): Promise<{ advisories: IntelAdvisory[]; sources: SourceStatus[]; warnings: string[] }> {
    const sources: SourceStatus[] = [];
    const warnings: string[] = [];
    const cves = [
      ...new Set(
        advisories
          .flatMap((advisory) => [advisory.id, ...advisory.aliases])
          .filter((id) => CVE_PATTERN.test(id)),
      ),
    ];
    const kev = new Set<string>();
    const epss = new Map<string, number>();
    let kevChecked = false;

    await Promise.all([
      (async () => {
        try {
          const raw = asRecord(
            await requestJson(INTEL_ENDPOINTS.kev, 'CISA KEV', {}, 60 * 60 * 1000),
          );
          if (
            !raw ||
            !Array.isArray(raw.vulnerabilities) ||
            !raw.vulnerabilities.length ||
            raw.vulnerabilities.some(
              (value) =>
                typeof asRecord(value)?.cveID !== 'string' ||
                !CVE_PATTERN.test(String(asRecord(value)?.cveID)),
            )
          )
            throw new IntelProviderError('CISA KEV returned an invalid catalogue.', 'CISA KEV');
          for (const value of raw.vulnerabilities) {
            const id = asRecord(value)?.cveID;
            if (typeof id === 'string' && CVE_PATTERN.test(id)) kev.add(id);
          }
          kevChecked = true;
          sources.push(status('CISA KEV', 'healthy'));
        } catch (error) {
          const message = readableError(error);
          sources.push(status('CISA KEV', 'unavailable', message));
          warnings.push(
            'Known-exploitation evidence could not be refreshed. An unflagged issue is not evidence that exploitation is absent.',
          );
        }
      })(),
      (async () => {
        if (!cves.length) return;
        try {
          const responses = await mapConcurrent(chunks(cves, 50), 2, async (batch) => {
            const endpoint = new URL(INTEL_ENDPOINTS.epss);
            endpoint.searchParams.set('cve', batch.join(','));
            return requestJson(endpoint.href, 'FIRST EPSS', {}, 6 * 60 * 60 * 1000);
          });
          for (const response of responses) {
            const data = asRecord(response)?.data;
            if (!Array.isArray(data))
              throw new IntelProviderError('FIRST EPSS returned invalid scores.', 'FIRST EPSS');
            for (const value of data) {
              const entry = asRecord(value);
              const probability =
                typeof entry?.epss === 'number' || typeof entry?.epss === 'string'
                  ? Number(entry.epss)
                  : NaN;
              if (
                typeof entry?.cve === 'string' &&
                CVE_PATTERN.test(entry.cve) &&
                Number.isFinite(probability) &&
                probability >= 0 &&
                probability <= 1
              )
                epss.set(entry.cve, probability);
            }
          }
          sources.push(status('FIRST EPSS', 'healthy'));
        } catch (error) {
          epss.clear();
          sources.push(status('FIRST EPSS', 'unavailable', readableError(error)));
          warnings.push(
            'Exploit-probability scores could not be refreshed. Severity and package matching are still available.',
          );
        }
      })(),
    ]);

    return {
      advisories: advisories.map((advisory) => {
        const ids = [advisory.id, ...advisory.aliases];
        const scores = ids
          .map((id) => epss.get(id))
          .filter((score): score is number => score !== undefined);
        const exploited = ids.some((id) => kev.has(id));
        const hasCve = ids.some((id) => CVE_PATTERN.test(id));
        return {
          ...advisory,
          exploited,
          exploitationStatus:
            kevChecked && hasCve ? (exploited ? 'known_exploited' : 'not_in_kev') : 'unknown',
          ...(kevChecked ? { exploitationCheckedAt: now().toISOString() } : {}),
          epss: scores.length ? Math.max(...scores) : null,
        };
      }),
      sources: sources.sort((a, b) => a.name.localeCompare(b.name)),
      warnings,
    };
  }

  async function scanImpl(packages: InventoryPackage[]): Promise<IntelScanResult> {
    if (!Array.isArray(packages) || !packages.length || packages.length > MAX_INVENTORY_PACKAGES)
      throw new IntelProviderError('Provide between 1 and 2,000 packages to assess.', 'Inventory');
    // Repeat validation at this service boundary; callers may bypass the upload parser.
    const validated = parseInventory(JSON.stringify(packages), 'inventory').packages;
    const idsByPackage = new Map<number, Set<string>>();
    const initialQueries = validated.map((pkg, index) => ({ index, pkg, pageToken: '' }));
    let pending = initialQueries;
    let page = 0;
    while (pending.length) {
      if (++page > 20)
        throw new IntelProviderError(
          'OSV pagination exceeded the assessment limit; split this inventory into smaller projects.',
          'OSV',
        );
      const next: typeof pending = [];
      await mapConcurrent(chunks(pending, 100), 2, async (batch) => {
        const response = asRecord(
          await requestJson(INTEL_ENDPOINTS.osvBatch, 'OSV', {
            method: 'POST',
            body: JSON.stringify({
              queries: batch.map(({ pkg, pageToken }) => ({
                package: { name: pkg.name, ecosystem: pkg.ecosystem },
                version: pkg.version,
                ...(pageToken ? { page_token: pageToken } : {}),
              })),
            }),
          }),
        );
        if (!Array.isArray(response?.results) || response.results.length !== batch.length)
          throw new IntelProviderError(
            'OSV returned an incomplete assessment. Previous findings have not been cleared.',
            'OSV',
          );
        for (let index = 0; index < batch.length; index++) {
          const query = batch[index]!;
          const result = asRecord(response.results[index]);
          if (
            !result ||
            result.error ||
            (result.vulns !== undefined && !Array.isArray(result.vulns))
          )
            throw new IntelProviderError('OSV returned invalid package results.', 'OSV');
          const ids = idsByPackage.get(query.index) ?? new Set<string>();
          for (const value of Array.isArray(result.vulns) ? result.vulns : []) {
            const id = asRecord(value)?.id;
            if (typeof id !== 'string' || !OSV_ID_PATTERN.test(id))
              throw new IntelProviderError('OSV returned an invalid advisory identifier.', 'OSV');
            ids.add(id);
          }
          idsByPackage.set(query.index, ids);
          if (result.next_page_token !== undefined && typeof result.next_page_token !== 'string')
            throw new IntelProviderError('OSV returned an invalid pagination cursor.', 'OSV');
          if (typeof result.next_page_token === 'string' && result.next_page_token)
            next.push({ ...query, pageToken: result.next_page_token });
        }
      });
      pending = next;
    }

    const advisoryIds = [...new Set([...idsByPackage.values()].flatMap((ids) => [...ids]))];
    if (advisoryIds.length > 2000)
      throw new IntelProviderError(
        'This inventory has more than 2,000 advisory records; split it into smaller projects.',
        'OSV',
      );
    const records = await mapConcurrent(advisoryIds, 6, async (id) => {
      const raw = await requestJson(
        `${INTEL_ENDPOINTS.osvAdvisory}${encodeURIComponent(id)}`,
        'OSV',
        {},
        5 * 60 * 1000,
      );
      const object = asRecord(raw);
      if (object?.id !== id)
        throw new IntelProviderError('OSV returned a mismatched advisory record.', 'OSV');
      const advisory = normalizeOsvAdvisory(raw);
      if (!advisory && !object?.withdrawn)
        throw new IntelProviderError('OSV returned an invalid advisory record.', 'OSV');
      return { id, raw, advisory };
    });
    const recordMap = new Map(records.map((record) => [record.id, record]));
    const matches: IntelMatch[] = [];
    validated.forEach((pkg, index) => {
      for (const id of idsByPackage.get(index) ?? []) {
        const record = recordMap.get(id);
        if (!record?.advisory) continue; // Withdrawn advisories are intentionally omitted.
        const affectsPackage = record.advisory.affected.some(
          (affected) =>
            affected.ecosystem === pkg.ecosystem &&
            normalizePackageName(affected.name, pkg.ecosystem) === pkg.name,
        );
        if (!affectsPackage)
          throw new IntelProviderError(
            'An OSV advisory does not match its queried package. Assessment stopped for review.',
            'OSV',
          );
        matches.push({
          advisory: record.advisory,
          packageName: pkg.name,
          installedVersion: pkg.version,
          ecosystem: pkg.ecosystem,
          fixedVersion: fixedVersionForPackage(record.raw, pkg),
        });
      }
    });
    const unique = deduplicateMatches(matches);
    const enrichment = await enrich(unique.map((match) => match.advisory));
    await recordStatuses([status('OSV', 'healthy'), ...enrichment.sources]);
    return {
      matches: unique.map((match, index) => ({
        ...match,
        advisory: enrichment.advisories[index]!,
      })),
      warnings: enrichment.warnings,
      sources: [status('OSV', 'healthy'), ...enrichment.sources],
      scannedAt: now().toISOString(),
    };
  }

  async function scan(packages: InventoryPackage[]) {
    try {
      return await scanImpl(packages);
    } catch (error) {
      if (error instanceof IntelProviderError)
        await recordStatuses([status(error.source, 'unavailable', error.message)]);
      throw error;
    }
  }

  async function getBriefings(): Promise<IntelBriefingsResult> {
    const sources: SourceStatus[] = [];
    const responses = await Promise.allSettled(
      ['reviewed', 'malware'].map(async (type) => {
        const endpoint = new URL(INTEL_ENDPOINTS.github);
        endpoint.searchParams.set('type', type);
        endpoint.searchParams.set('is_withdrawn', 'false');
        endpoint.searchParams.set('sort', 'updated');
        endpoint.searchParams.set('direction', 'desc');
        endpoint.searchParams.set('per_page', type === 'reviewed' ? '50' : '20');
        const name = type === 'reviewed' ? 'GitHub Advisory Database' : 'GitHub malware advisories';
        try {
          const data = await requestJson(endpoint.href, name, {}, 5 * 60 * 1000);
          if (!Array.isArray(data))
            throw new IntelProviderError(`${name} returned an invalid feed.`, name);
          if (data.some((value) => !validGitHubRecord(value)))
            throw new IntelProviderError(`${name} returned malformed advisory records.`, name);
          sources.push(status(name, 'healthy'));
          return data
            .map(normalizeGitHubAdvisory)
            .filter((advisory): advisory is IntelAdvisory => advisory !== null);
        } catch (error) {
          sources.push(status(name, 'unavailable', readableError(error)));
          throw error;
        }
      }),
    );
    if (responses.every((result) => result.status === 'rejected')) {
      await recordStatuses(sources);
      throw new IntelProviderError(
        'Public briefings could not be refreshed. Try again later.',
        'GitHub Advisory Database',
      );
    }
    const advisories = deduplicateAdvisories(
      responses.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
    );
    const enrichment = await enrich(advisories);
    await recordStatuses([...sources, ...enrichment.sources]);
    return {
      advisories: enrichment.advisories.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
      sources: [...sources.sort((a, b) => a.name.localeCompare(b.name)), ...enrichment.sources],
      fetchedAt: now().toISOString(),
    };
  }

  async function probe(source: IntelSourceId) {
    const name =
      source === 'osv'
        ? 'OSV'
        : source === 'github'
          ? 'GitHub Advisory Database'
          : source === 'kev'
            ? 'CISA KEV'
            : 'FIRST EPSS';
    try {
      if (source === 'osv') {
        // A fixed public sample, never a customer's inventory, exercises the query endpoint.
        const result = asRecord(
          await requestJson(
            INTEL_ENDPOINTS.osvBatch,
            name,
            {
              method: 'POST',
              body: JSON.stringify({
                queries: [{ package: { name: 'jinja2', ecosystem: 'PyPI' }, version: '2.4.1' }],
              }),
            },
            0,
            true,
          ),
        );
        const first =
          Array.isArray(result?.results) && result.results.length === 1
            ? asRecord(result.results[0])
            : null;
        if (
          !first ||
          first.error ||
          (first.vulns !== undefined &&
            (!Array.isArray(first.vulns) ||
              first.vulns.some(
                (value) =>
                  typeof asRecord(value)?.id !== 'string' ||
                  !OSV_ID_PATTERN.test(String(asRecord(value)?.id)),
              ))) ||
          (first.next_page_token !== undefined && typeof first.next_page_token !== 'string')
        )
          throw new IntelProviderError('OSV returned invalid probe results.', name);
      } else if (source === 'github') {
        for (const type of ['reviewed', 'malware']) {
          const endpoint = new URL(INTEL_ENDPOINTS.github);
          endpoint.searchParams.set('type', type);
          endpoint.searchParams.set('is_withdrawn', 'false');
          endpoint.searchParams.set('per_page', '1');
          const result = await requestJson(endpoint.href, name, {}, 0, true);
          if (!Array.isArray(result) || result.some((value) => !validGitHubRecord(value)))
            throw new IntelProviderError('GitHub returned invalid probe advisories.', name);
        }
      } else if (source === 'kev') {
        const result = asRecord(await requestJson(INTEL_ENDPOINTS.kev, name, {}, 0, true));
        if (
          !Array.isArray(result?.vulnerabilities) ||
          !result.vulnerabilities.length ||
          result.vulnerabilities.some(
            (value) =>
              typeof asRecord(value)?.cveID !== 'string' ||
              !CVE_PATTERN.test(String(asRecord(value)?.cveID)),
          )
        )
          throw new IntelProviderError('CISA KEV returned an invalid probe catalogue.', name);
      } else {
        const result = asRecord(
          await requestJson(`${INTEL_ENDPOINTS.epss}?cve=CVE-2021-44228`, name, {}, 0, true),
        );
        if (
          !Array.isArray(result?.data) ||
          !result.data.some((value) => {
            const entry = asRecord(value);
            const score =
              typeof entry?.epss === 'string' || typeof entry?.epss === 'number'
                ? Number(entry.epss)
                : NaN;
            return (
              entry?.cve === 'CVE-2021-44228' && Number.isFinite(score) && score >= 0 && score <= 1
            );
          })
        )
          throw new IntelProviderError('FIRST EPSS returned invalid probe scores.', name);
      }
      await recordStatuses([status(name, 'healthy')]);
    } catch (error) {
      await recordStatuses([status(name, 'unavailable', readableError(error))]);
      throw error;
    }
  }
  return { scan, getBriefings, probe, clearCache: () => cache.clear() };
}

export const intelProvider = createIntelProvider({ control: sourceControlService });
export const scanInventory = (packages: InventoryPackage[]) => intelProvider.scan(packages);
export const fetchBriefings = () => intelProvider.getBriefings();
