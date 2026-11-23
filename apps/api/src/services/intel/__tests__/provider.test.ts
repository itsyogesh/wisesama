import { describe, expect, it, vi } from 'vitest';
import { createIntelProvider, INTEL_ENDPOINTS } from '../provider';
import { IntelProviderError, type InventoryPackage } from '../types';

const inventory: InventoryPackage[] = [{ name: 'pkg', version: '1.0.0', ecosystem: 'npm' }];
const clock = () => new Date('2026-11-04T00:00:00Z');
const cve = 'CVE-2026-12345';
const ghsa = 'GHSA-abcd-efgh-ijkl';
const record = (id = ghsa) => ({
  id,
  aliases: [cve],
  summary: 'Package parser vulnerability',
  details: 'Vendor remediation guidance.',
  published: '2026-10-21T00:00:00Z',
  modified: '2026-11-03T00:00:00Z',
  database_specific: { severity: 'HIGH' },
  affected: [
    {
      package: { name: 'pkg', ecosystem: 'npm' },
      ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.2.3' }] }],
    },
  ],
  references: [{ type: 'ADVISORY', url: 'https://github.com/advisories/test' }],
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

function mockFetch(
  handler?: (
    url: string,
    init: RequestInit | undefined,
  ) => Response | Promise<Response> | undefined,
) {
  return vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const override = await handler?.(url, init);
    if (override) return override;
    if (url === INTEL_ENDPOINTS.osvBatch) return json({ results: [{ vulns: [{ id: ghsa }] }] });
    if (url.startsWith(INTEL_ENDPOINTS.osvAdvisory))
      return json(record(decodeURIComponent(url.slice(INTEL_ENDPOINTS.osvAdvisory.length))));
    if (url === INTEL_ENDPOINTS.kev) return json({ vulnerabilities: [{ cveID: cve }] });
    if (url.startsWith(INTEL_ENDPOINTS.epss)) return json({ data: [{ cve, epss: '0.42' }] });
    if (url.startsWith(INTEL_ENDPOINTS.github)) return json([]);
    throw new Error(`Unexpected test URL: ${url}`);
  });
}

describe('inventory assessment', () => {
  it('queries exact ecosystem and installed version, then enriches confirmed package matches', async () => {
    const fetch = mockFetch();
    const result = await createIntelProvider({ fetch, now: clock }).scan(inventory);
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as unknown;
    expect(body).toEqual({
      queries: [{ package: { name: 'pkg', ecosystem: 'npm' }, version: '1.0.0' }],
    });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      packageName: 'pkg',
      installedVersion: '1.0.0',
      fixedVersion: '1.2.3',
      advisory: { id: ghsa, exploited: true, epss: 0.42 },
    });
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'OSV', status: 'healthy' }),
        expect.objectContaining({ name: 'CISA KEV', status: 'healthy' }),
      ]),
    );
    expect(result.warnings).toEqual([]);
    expect(result.scannedAt).toBe(clock().toISOString());
  });

  it('revalidates inventories passed directly to the scanner', async () => {
    const fetch = mockFetch();
    const provider = createIntelProvider({ fetch });
    await expect(
      provider.scan([{ name: 'pkg', version: '^1.0.0', ecosystem: 'npm' }]),
    ).rejects.toThrow(/exact installed version/);
    await expect(provider.scan([])).rejects.toThrow(/between 1 and 2,000/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not silently clear findings when OSV returns an error', async () => {
    const fetch = mockFetch((url) =>
      url === INTEL_ENDPOINTS.osvBatch ? json({ error: 'unavailable' }, 503) : undefined,
    );
    await expect(createIntelProvider({ fetch }).scan(inventory)).rejects.toThrow(
      IntelProviderError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles upstream rate limits explicitly', async () => {
    const fetch = mockFetch((url) =>
      url === INTEL_ENDPOINTS.osvBatch ? json({}, 429) : undefined,
    );
    await expect(createIntelProvider({ fetch }).scan(inventory)).rejects.toThrow(/rate-limited/);
  });

  it('treats malformed or missing package results as an incomplete scan', async () => {
    for (const data of [
      {},
      { results: [] },
      { results: [null] },
      { results: [{ vulns: 'oops' }] },
      { results: [{ vulns: [{ id: '../invalid' }] }] },
    ]) {
      const fetch = mockFetch((url) => (url === INTEL_ENDPOINTS.osvBatch ? json(data) : undefined));
      await expect(createIntelProvider({ fetch }).scan(inventory)).rejects.toThrow(
        IntelProviderError,
      );
    }
  });

  it('consumes every page before returning a complete scan', async () => {
    let batchCall = 0;
    const fetch = mockFetch((url, init) => {
      if (url !== INTEL_ENDPOINTS.osvBatch) return;
      batchCall++;
      if (batchCall === 1)
        return json({ results: [{ vulns: [{ id: ghsa }], next_page_token: 'cursor' }] });
      expect(JSON.parse(String(init?.body))).toEqual({
        queries: [
          { package: { name: 'pkg', ecosystem: 'npm' }, version: '1.0.0', page_token: 'cursor' },
        ],
      });
      return json({ results: [{ vulns: [{ id: 'PYSEC-2026-1' }] }] });
    });
    const result = await createIntelProvider({ fetch }).scan(inventory);
    expect(batchCall).toBe(2);
    expect(result.matches).toHaveLength(1); // OSV and PYSEC aliases describe the same CVE.
    expect(result.matches[0]?.advisory.aliases).toContain('PYSEC-2026-1');
  });

  it('does not trust an advisory that belongs to a different package', async () => {
    const fetch = mockFetch((url) =>
      url.startsWith(INTEL_ENDPOINTS.osvAdvisory)
        ? json({ ...record(), affected: [{ package: { name: 'other', ecosystem: 'npm' } }] })
        : undefined,
    );
    await expect(createIntelProvider({ fetch }).scan(inventory)).rejects.toThrow(/does not match/);
  });

  it('requires a matching detail record and skips explicitly withdrawn records', async () => {
    const mismatch = mockFetch((url) =>
      url.startsWith(INTEL_ENDPOINTS.osvAdvisory) ? json(record('OTHER-1')) : undefined,
    );
    await expect(createIntelProvider({ fetch: mismatch }).scan(inventory)).rejects.toThrow(
      /mismatched/,
    );
    const withdrawn = mockFetch((url) =>
      url.startsWith(INTEL_ENDPOINTS.osvAdvisory)
        ? json({ ...record(), withdrawn: '2026-11-03T00:00:00Z' })
        : undefined,
    );
    expect((await createIntelProvider({ fetch: withdrawn }).scan(inventory)).matches).toEqual([]);
  });

  it('retains matches and shows uncertainty when KEV and EPSS are unavailable', async () => {
    const fetch = mockFetch((url) =>
      url === INTEL_ENDPOINTS.kev || url.startsWith(INTEL_ENDPOINTS.epss)
        ? json({}, 503)
        : undefined,
    );
    const result = await createIntelProvider({ fetch }).scan(inventory);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.advisory.epss).toBeNull();
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('not evidence that exploitation is absent'),
        expect.stringContaining('could not be refreshed'),
      ]),
    );
    expect(result.sources.filter((source) => source.status === 'unavailable')).toHaveLength(2);
  });

  it('only marks KEV exploitation for an exact matching CVE and accepts valid probability bounds', async () => {
    const fetch = mockFetch((url) => {
      if (url === INTEL_ENDPOINTS.kev)
        return json({ vulnerabilities: [{ cveID: 'CVE-2026-99999' }] });
      if (url.startsWith(INTEL_ENDPOINTS.epss))
        return json({
          data: [
            { cve, epss: '9.2' },
            { cve: 'CVE-2026-99999', epss: '0.9' },
          ],
        });
    });
    const result = await createIntelProvider({ fetch }).scan(inventory);
    expect(result.matches[0]?.advisory).toMatchObject({ exploited: false, epss: null });
  });

  it('caches enrichment/detail requests while refreshing package queries', async () => {
    const fetch = mockFetch();
    const provider = createIntelProvider({ fetch, now: clock });
    await provider.scan(inventory);
    await provider.scan(inventory);
    expect(
      fetch.mock.calls.filter(([url]) => String(url) === INTEL_ENDPOINTS.osvBatch),
    ).toHaveLength(2);
    expect(fetch.mock.calls.filter(([url]) => String(url) === INTEL_ENDPOINTS.kev)).toHaveLength(1);
    expect(
      fetch.mock.calls.filter(([url]) => String(url).startsWith(INTEL_ENDPOINTS.osvAdvisory)),
    ).toHaveLength(1);
    provider.clearCache();
    await provider.scan(inventory);
    expect(fetch.mock.calls.filter(([url]) => String(url) === INTEL_ENDPOINTS.kev)).toHaveLength(2);
  });

  it('fails safely on aborted requests, invalid JSON, and oversized responses', async () => {
    const unavailable = vi.fn<typeof fetch>(async () => {
      throw new DOMException('Timeout', 'TimeoutError');
    });
    await expect(createIntelProvider({ fetch: unavailable }).scan(inventory)).rejects.toThrow(
      /could not be checked/,
    );
    const invalid = mockFetch((url) =>
      url === INTEL_ENDPOINTS.osvBatch ? new Response('not-json') : undefined,
    );
    await expect(createIntelProvider({ fetch: invalid }).scan(inventory)).rejects.toThrow(
      /could not be checked/,
    );
    const oversized = mockFetch((url) =>
      url === INTEL_ENDPOINTS.osvBatch
        ? new Response('{}', { headers: { 'content-length': String(13 * 1024 * 1024) } })
        : undefined,
    );
    await expect(createIntelProvider({ fetch: oversized }).scan(inventory)).rejects.toThrow(
      /oversized/,
    );
  });
});

describe('public briefing feed', () => {
  it('requests reviewed and malware advisories explicitly and preserves real source metadata', async () => {
    const fetch = mockFetch((url) => {
      if (url.startsWith(INTEL_ENDPOINTS.github))
        return json(
          new URL(url).searchParams.get('type') === 'reviewed'
            ? [
                {
                  ghsa_id: ghsa,
                  cve_id: cve,
                  summary: 'Published upstream advisory',
                  severity: 'high',
                  published_at: '2026-10-21T00:00:00Z',
                  updated_at: '2026-11-03T00:00:00Z',
                  vulnerabilities: [
                    {
                      package: { name: 'pkg', ecosystem: 'npm' },
                      vulnerable_version_range: '< 1.2.3',
                    },
                  ],
                },
              ]
            : [],
        );
    });
    const result = await createIntelProvider({ fetch, now: clock }).getBriefings();
    expect(result.advisories[0]).toMatchObject({
      id: ghsa,
      title: 'Published upstream advisory',
      exploited: true,
      epss: 0.42,
    });
    expect(fetch.mock.calls.some(([url]) => String(url).includes('type=malware'))).toBe(true);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('type=reviewed'))).toBe(true);
    expect(result.fetchedAt).toBe(clock().toISOString());
  });

  it('returns an explicit partial-source status if one GitHub feed fails', async () => {
    const fetch = mockFetch((url) =>
      url.startsWith(INTEL_ENDPOINTS.github) && new URL(url).searchParams.get('type') === 'malware'
        ? json({}, 403)
        : undefined,
    );
    const result = await createIntelProvider({ fetch }).getBriefings();
    expect(result.sources).toContainEqual(
      expect.objectContaining({ name: 'GitHub malware advisories', status: 'unavailable' }),
    );
  });

  it('does not fabricate an empty healthy feed if both upstream feeds fail', async () => {
    const fetch = mockFetch((url) =>
      url.startsWith(INTEL_ENDPOINTS.github) ? json({}, 503) : undefined,
    );
    await expect(createIntelProvider({ fetch }).getBriefings()).rejects.toThrow(
      /could not be refreshed/,
    );
  });
});
