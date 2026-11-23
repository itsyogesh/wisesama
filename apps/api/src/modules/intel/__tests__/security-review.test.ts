import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { organizationFixture } from '../../../services/__tests__/organization-fixture';
import type { IntelAdvisory, IntelMatch } from '../../../services/intel/index';

vi.mock('@wisesama/database', () => ({ prisma: {}, Prisma: { DbNull: null } }));

import { createIntelWorkspaceService } from '../../../services/intel-workspace.service';

const NOW = new Date('2026-11-04T10:00:00.000Z');
const advisory: IntelAdvisory = {
  id: 'GHSA-security-review',
  aliases: ['CVE-2026-12345'],
  title: 'Test-only shared vulnerability',
  summary: 'Synthetic advisory for persistence regressions.',
  severity: 'high',
  cvss: 8.1,
  exploited: false,
  epss: null,
  publishedAt: NOW.toISOString(),
  modifiedAt: NOW.toISOString(),
  references: [{ url: 'https://example.org/advisory' }],
  affected: [{ name: 'example', ecosystem: 'npm' }],
  source: 'OSV',
};

type Row = Record<string, unknown>;
type FindingRow = Row & {
  id: string;
  projectId: string;
  advisoryId: string;
  ecosystem: string;
  packageName: string;
  installedVersion: string;
  status: string;
};
type UpsertInput = { where: Record<string, Row>; create: Row; update: Row };

/** Stateful records reproduce cross-project behavior that independent vi.fn responses miss. */
function setup() {
  const access = organizationFixture('owner');
  const findings = new Map<string, FindingRow>();
  const advisories = new Map<string, Row>();
  const deliveries = new Map<string, Row>();
  const findByKey = (where: Record<string, Row>) => {
    const key = Object.values(where)[0] ?? {};
    return (
      [...findings.values()].find((row) =>
        Object.entries(key).every(([name, value]) => row[name] === value),
      ) ?? null
    );
  };
  const db = {
    organizationMember: access.organizationMember,
    securityProject: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (!['project-a', 'project-b'].includes(String(where.id))) return null;
        const project = {
          id: String(where.id),
          userId: 'owner',
          organizationId: 'org-1',
          name: String(where.id),
          environment: 'production',
          packages: [{ name: 'example', version: '1.0.0', ecosystem: 'npm' }],
          runtime: null,
          inventoryRevision: 'revision-1',
          inventoryUpdatedAt: NOW,
          createdAt: NOW,
          lastScannedAt: null,
          scanError: null,
          scanToken: null,
          sources: [],
          warnings: [],
          _count: { findings: 0 },
        };
        return access.projectMatches(where, project) ? project : null;
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    securityAdvisory: {
      findFirst: vi.fn(async () => advisories.get(advisory.id) ?? null),
      upsert: vi.fn(
        async ({ where, create, update }: { where: { id: string }; create: Row; update: Row }) => {
          const row = advisories.has(where.id)
            ? { ...advisories.get(where.id), ...update }
            : create;
          advisories.set(where.id, row);
          return row;
        },
      ),
    },
    securityFinding: {
      findUnique: vi.fn(async ({ where }: { where: Record<string, Row> }) => findByKey(where)),
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async ({ where, create, update }: UpsertInput) => {
        const existing = findByKey(where);
        const row = existing
          ? { ...existing, ...update }
          : {
              id: `finding-${findings.size + 1}`,
              status: 'open',
              evidence: '',
              note: '',
              resolvedAt: null,
              firstSeenAt: NOW,
              lastSeenAt: NOW,
              ...create,
            };
        findings.set(String(row.id), row as FindingRow);
        return row;
      }),
    },
    securityFindingEvent: { create: vi.fn(async () => ({})) },
    securityNotificationSettings: { findUnique: vi.fn(async () => ({ emailEnabled: true })) },
    securityDelivery: {
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async ({ where, create }: { where: { eventKey: string }; create: Row }) => {
        if (!deliveries.has(where.eventKey)) deliveries.set(where.eventKey, create);
        return deliveries.get(where.eventKey);
      }),
    },
    user: { findUnique: vi.fn(async () => ({ email: 'owner@example.org', emailVerified: true })) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  const provider = {
    scan: vi.fn(async () => ({
      matches: [] as IntelMatch[],
      warnings: [] as string[],
      sources: [{ name: 'CISA KEV', status: 'healthy' as const, checkedAt: NOW.toISOString() }],
      scannedAt: NOW.toISOString(),
    })),
    getBriefings: vi.fn(async () => ({
      advisories: [] as IntelAdvisory[],
      sources: [],
      fetchedAt: NOW.toISOString(),
    })),
  };
  const service = createIntelWorkspaceService({
    db: db as unknown as PrismaClient,
    provider,
    now: () => NOW,
  });
  return { service, provider, findings, deliveries };
}

const match = (version: string, exploited = false): IntelMatch => ({
  advisory: { ...advisory, exploited },
  ecosystem: 'npm',
  packageName: 'example',
  installedVersion: version,
  fixedVersion: version.startsWith('1.') ? '1.0.1' : '2.0.1',
});

describe('independent security persistence regressions', () => {
  it('keeps independently actionable findings for two affected installed versions', async () => {
    const { provider, service, findings } = setup();
    provider.scan.mockResolvedValue({
      matches: [match('1.0.0'), match('2.0.0')],
      warnings: [],
      sources: [],
      scannedAt: NOW.toISOString(),
    });
    await service.scanProject('owner', 'project-a');
    expect(findings.size).toBe(2);
    expect([...findings.values()].map((row) => row.installedVersion).sort()).toEqual([
      '1.0.0',
      '2.0.0',
    ]);
    expect(new Set([...findings.values()].map((row) => row.id)).size).toBe(2);
  });

  it('notifies both projects when a shared advisory gains exploitation evidence', async () => {
    const { provider, service, deliveries } = setup();
    const scan = (exploited: boolean) => ({
      matches: [match('1.0.0', exploited)],
      warnings: [],
      sources: [{ name: 'CISA KEV', status: 'healthy' as const, checkedAt: NOW.toISOString() }],
      scannedAt: NOW.toISOString(),
    });
    provider.scan.mockResolvedValue(scan(false));
    await service.scanProject('owner', 'project-a');
    await service.scanProject('owner', 'project-b');
    expect(deliveries.size).toBe(2);

    provider.scan.mockResolvedValue(scan(true));
    await service.scanProject('owner', 'project-a');
    await service.scanProject('owner', 'project-b');
    expect(deliveries.size).toBe(4);
    for (const projectId of ['project-a', 'project-b']) {
      const projectDeliveries = [...deliveries.values()].filter(
        (row) => row.projectId === projectId,
      );
      expect(projectDeliveries).toHaveLength(2);
      expect(
        projectDeliveries.some((row) =>
          String(row.body).includes('Exploitation: Reported by the advisory source'),
        ),
      ).toBe(true);
    }
  });

  it('alerts once when the same affected version reopens a previously closed response', async () => {
    const { provider, service, findings, deliveries } = setup();
    provider.scan.mockResolvedValue({
      matches: [match('1.0.0')],
      warnings: [],
      sources: [],
      scannedAt: NOW.toISOString(),
    });
    await service.scanProject('owner', 'project-a');
    expect(deliveries.size).toBe(1);
    const existing = [...findings.values()][0]!;
    findings.set(existing.id, {
      ...existing,
      status: 'resolved',
      resolvedAt: NOW,
      evidence: 'Deployed fix was claimed.',
    });

    await service.scanProject('owner', 'project-a');
    expect(findings.get(existing.id)?.status).toBe('open');
    expect(deliveries.size).toBe(2);
    await service.scanProject('owner', 'project-a');
    expect(deliveries.size).toBe(2);
  });
});
