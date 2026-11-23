import { describe, expect, it } from 'vitest';
import {
  cvss3Score,
  deduplicateAdvisories,
  deduplicateMatches,
  fixedVersionForPackage,
  normalizeGitHubAdvisory,
  normalizeOsvAdvisory,
} from '../normalize';
import type { IntelAdvisory, InventoryPackage } from '../types';

const pkg: InventoryPackage = { name: 'pkg', version: '1.0.0', ecosystem: 'npm' };
const rawAdvisory = (id: string, aliases: string[] = []) => ({
  id,
  aliases,
  summary: 'Test advisory',
  details: 'Source-backed details',
  published: '2026-10-01T00:00:00Z',
  modified: '2026-10-02T00:00:00Z',
  severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }],
  affected: [
    {
      package: { name: 'pkg', ecosystem: 'npm' },
      ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.2.3' }] }],
    },
  ],
  references: [
    { type: 'ADVISORY', url: 'https://example.com/advisory' },
    { url: 'javascript:alert(1)' },
  ],
});

describe('source normalization', () => {
  it('calculates CVSS v3 base severity without claiming support for v4 vectors', () => {
    expect(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')).toBe(9.8);
    expect(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H')).toBe(10);
    expect(cvss3Score('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N')).toBe(0);
    expect(cvss3Score('CVSS:4.0/AV:N/AC:L')).toBeNull();
    expect(cvss3Score('CVSS:3.1/AV:N')).toBeNull();
  });

  it('retains facts and sanitizes source links', () => {
    const normalized = normalizeOsvAdvisory(
      rawAdvisory('GHSA-test-test-test', ['CVE-2026-12345']),
    )!;
    expect(normalized).toMatchObject({
      cvss: 9.8,
      severity: 'critical',
      exploited: false,
      epss: null,
    });
    expect(normalized.references).toHaveLength(1);
    expect(normalized.affected[0]?.ranges).toEqual(['<1.2.3']);
    expect(normalized.publishedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(
      normalizeOsvAdvisory({ ...rawAdvisory('withdrawn'), withdrawn: '2026-10-03' }),
    ).toBeNull();
  });

  it('uses explicit source severity when a v4 score cannot be computed', () => {
    expect(
      normalizeOsvAdvisory({
        ...rawAdvisory('test'),
        severity: [{ type: 'CVSS_V4', score: 'CVSS:4.0/AV:N' }],
        database_specific: { severity: 'MODERATE' },
      })?.severity,
    ).toBe('medium');
    expect(normalizeOsvAdvisory({ id: 'test' })?.publishedAt).toBe('');
  });

  it('normalizes GitHub affected package ecosystems and malware source', () => {
    expect(
      normalizeGitHubAdvisory({
        ghsa_id: 'GHSA-test-test-test',
        cve_id: 'CVE-2026-12345',
        summary: 'Malicious package',
        type: 'malware',
        severity: 'high',
        vulnerabilities: [
          {
            package: { ecosystem: 'pip', name: 'Some_Package' },
            vulnerable_version_range: '< 2.0',
            first_patched_version: '2.0',
          },
        ],
        html_url: 'https://github.com/advisories/GHSA-test-test-test',
        references: ['https://example.com'],
      }),
    ).toMatchObject({
      source: 'GitHub malware advisories',
      aliases: ['CVE-2026-12345'],
      affected: [
        { ecosystem: 'PyPI', name: 'some-package', ranges: ['< 2.0'], fixedVersion: '2.0' },
      ],
    });
  });
});

describe('branch-aware remediation', () => {
  const raw = {
    affected: [
      {
        package: { name: 'pkg', ecosystem: 'npm' },
        ranges: [
          {
            type: 'SEMVER',
            events: [
              { introduced: '0' },
              { fixed: '1.2.3' },
              { introduced: '2.0.0' },
              { fixed: '2.4.5' },
            ],
          },
        ],
      },
    ],
  };
  it('recommends only the fixed boundary of the affected installed interval', () => {
    expect(fixedVersionForPackage(raw, pkg)).toBe('1.2.3');
    expect(fixedVersionForPackage(raw, { ...pkg, version: '2.1.0' })).toBe('2.4.5');
    expect(fixedVersionForPackage(raw, { ...pkg, version: '1.5.0' })).toBeUndefined();
    expect(fixedVersionForPackage(raw, { ...pkg, name: 'other' })).toBeUndefined();
  });

  it('does not treat a last-affected or limit event as a patch', () => {
    for (const end of [{ last_affected: '1.2.3' }, { limit: '1.2.3' }]) {
      expect(
        fixedVersionForPackage(
          {
            affected: [
              { package: pkg, ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, end] }] },
            ],
          },
          pkg,
        ),
      ).toBeUndefined();
    }
  });

  it('handles numeric Python versions conservatively', () => {
    const raw = {
      affected: [
        {
          package: { name: 'fastapi', ecosystem: 'PyPI' },
          ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '0' }, { fixed: '0.109.1' }] }],
        },
      ],
    };
    expect(
      fixedVersionForPackage(raw, { name: 'fastapi', version: '0.95.1', ecosystem: 'PyPI' }),
    ).toBe('0.109.1');
    expect(
      fixedVersionForPackage(raw, { name: 'fastapi', version: '0.109.1rc1', ecosystem: 'PyPI' }),
    ).toBeUndefined();
  });
});

describe('alias deduplication', () => {
  const advisory = (id: string, aliases: string[]): IntelAdvisory =>
    normalizeOsvAdvisory(rawAdvisory(id, aliases))!;
  it('merges transitive alias groups while keeping unrelated vulnerabilities', () => {
    const result = deduplicateAdvisories([
      advisory('PYSEC-2026-1', ['CVE-2026-11111']),
      advisory('GHSA-abcd-abcd-abcd', ['CVE-2026-22222']),
      advisory('CVE-2026-11111', ['CVE-2026-22222']),
      advisory('OTHER-1', []),
    ]);
    expect(result).toHaveLength(2);
    expect(result.find((entry) => entry.id.startsWith('GHSA-'))?.aliases).toEqual([
      'CVE-2026-11111',
      'CVE-2026-22222',
      'PYSEC-2026-1',
    ]);
  });

  it('does not merge findings for different installed versions', () => {
    const first = {
      advisory: advisory('GHSA-abcd-abcd-abcd', ['CVE-2026-11111']),
      packageName: 'pkg',
      installedVersion: '1.0.0',
      ecosystem: 'npm' as const,
      fixedVersion: '1.2.3',
    };
    const result = deduplicateMatches([
      first,
      { ...first, advisory: advisory('PYSEC-2026-1', ['CVE-2026-11111']) },
      { ...first, installedVersion: '1.1.0' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('withholds contradictory upstream upgrade boundaries', () => {
    const first = {
      advisory: advisory('GHSA-abcd-abcd-abcd', ['CVE-2026-11111']),
      packageName: 'pkg',
      installedVersion: '1.0.0',
      ecosystem: 'npm' as const,
      fixedVersion: '1.2.3',
    };
    expect(
      deduplicateMatches([first, { ...first, fixedVersion: '2.0.0' }])[0]?.fixedVersion,
    ).toBeUndefined();
  });
});
