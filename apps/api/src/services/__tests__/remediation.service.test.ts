import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import type { IntelAdvisory, IntelScanResult } from '../intel';
import { organizationFixture } from './organization-fixture';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
vi.mock('../repository.service', () => ({ repositoryService: { sync: vi.fn() } }));

import {
  createRemediationService,
  remediationFields,
  remediationInput,
} from '../remediation.service';

const NOW = new Date('2026-11-24T10:00:00Z');
const SHA = 'a'.repeat(40);
const advisory: IntelAdvisory = {
  id: 'GHSA-test',
  aliases: ['CVE-2026-12345'],
  title: 'Test advisory',
  summary: 'Untrusted advisory text',
  severity: 'high',
  cvss: 8,
  exploited: false,
  epss: null,
  publishedAt: NOW.toISOString(),
  modifiedAt: NOW.toISOString(),
  references: [],
  affected: [],
  source: 'OSV',
};
function setup(connected = true) {
  const access = organizationFixture('owner');
  const source = {
    id: 'source-1',
    repositoryName: 'team/repo',
    repositoryUrl: 'https://github.com/team/repo',
    provider: 'github',
    branch: 'main',
    paths: ['package-lock.json'],
    scope: 'repository',
    importedCommit: SHA,
    observedCommit: SHA,
    lastSyncedAt: NOW,
    status: 'current',
    error: null,
    syncToken: null,
    paused: false,
    credential: 'DO-NOT-EXPORT',
    accessToken: 'DO-NOT-EXPORT',
  };
  const project = {
    id: 'project-1',
    organizationId: 'org-1',
    name: 'Test project',
    environment: 'production',
    packages: [{ name: 'example', version: '1.0.1', ecosystem: 'npm' }],
    inventoryRevision: 'inventory-2',
    scanError: null,
    scanToken: null,
    warnings: [] as string[],
    repositorySource: connected ? source : null,
  };
  const finding = {
    id: 'finding-1',
    projectId: project.id,
    project,
    advisoryId: advisory.id,
    advisory: { data: { ...advisory } },
    packageName: 'example',
    ecosystem: 'npm',
    installedVersion: '1.0.0',
    fixedVersion: '1.0.1',
    status: 'open',
    resolvedAt: null,
    evidence: '',
    remediation: {},
    remediationRevision: 0,
    events: [] as Array<{
      id: string;
      actorId: string;
      status: string;
      note: string;
      remediation: unknown;
      createdAt: Date;
    }>,
  };
  const db = {
    organizationMember: access.organizationMember,
    securityProject: {
      findFirst: vi.fn(async ({ where }) =>
        access.projectMatches(where, project) ? project : null,
      ),
    },
    securityFinding: {
      findFirst: vi.fn(async ({ where }) =>
        where.id === finding.id && access.projectMatches(where.project, project) ? finding : null,
      ),
      updateMany: vi.fn(async ({ where, data }) => {
        if (
          where.remediationRevision !== finding.remediationRevision ||
          !access.projectMatches(where.project, project)
        )
          return { count: 0 };
        finding.remediation = data.remediation;
        finding.remediationRevision++;
        return { count: 1 };
      }),
    },
    securityFindingEvent: {
      create: vi.fn(async ({ data }) => {
        const event = { ...data, id: `event-${finding.events.length}`, createdAt: NOW };
        finding.events.push(event);
        return event;
      }),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn) => fn(db));
  const provider = {
    scan: vi.fn<() => Promise<IntelScanResult>>().mockResolvedValue({
      matches: [],
      warnings: [],
      sources: [{ name: 'OSV', status: 'healthy', checkedAt: NOW.toISOString() }],
      scannedAt: NOW.toISOString(),
    }),
  };
  const sync = vi.fn().mockResolvedValue({});
  let currentTime = NOW;
  const service = createRemediationService({
    db: db as unknown as PrismaClient,
    provider,
    sync: sync as never,
    now: () => currentTime,
  });
  return {
    access,
    source,
    project,
    finding,
    db,
    provider,
    sync,
    service,
    tick: (ms: number) => {
      currentTime = new Date(NOW.getTime() + ms);
    },
  };
}

describe('finding remediation evidence', () => {
  it('keeps the private evidence behind live organization membership', async () => {
    const { service, access } = setup();
    await expect(service.get('outsider', 'finding-1')).rejects.toMatchObject({ statusCode: 404 });
    access.suspended.add('owner');
    await expect(service.get('owner', 'finding-1')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('does not expose connector credentials in reports or agent context', async () => {
    const { service } = setup();
    const report = await service.get('owner', 'finding-1');
    const handoff = await service.handoff('owner', 'finding-1');
    expect(JSON.stringify({ report, handoff })).not.toContain('DO-NOT-EXPORT');
    expect(handoff.prompt).toContain('untrusted reference data');
    expect(handoff.prompt).toContain('Deployment requires its own evidence');
    expect(handoff.context.repository?.assessedCommit).toBe(SHA);
  });
  it('records handoffs as activity without changing finding status', async () => {
    const { service, finding } = setup();
    await service.handoff('owner', finding.id);
    expect(finding.status).toBe('open');
    expect(finding.events[0]?.note).toBe('Agent remediation handoff prepared');
  });
  it('rejects secrets in URLs, non-HTTPS links, abbreviated commits, and extra fields', () => {
    for (const fields of [
      { deploymentUrl: 'javascript:alert(1)' },
      { deploymentUrl: 'https://secret@example.com' },
      { fixedCommit: '123abc' },
      { recheck: { result: 'clear' } },
    ])
      expect(remediationFields.safeParse(fields).success).toBe(false);
    expect(remediationInput.safeParse({ revision: -1, fields: {} }).success).toBe(false);
  });
  it('rejects pull requests from other repositories and lookalike repository prefixes', async () => {
    const { service } = setup();
    for (const pullRequestUrl of [
      'https://github.com/other/repo/pull/1',
      'https://github.com/team/repo-evil/pull/1',
      'https://github.com/team/repo/pull/1?secret=x',
      'https://example.com/team/repo/pull/1',
    ]) {
      await expect(
        service.save('owner', 'finding-1', {
          revision: 0,
          fields: remediationFields.parse({ pullRequestUrl }),
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    }
  });
  it('accepts a repository PR, keeps provenance, and records an immutable snapshot', async () => {
    const { service, finding } = setup();
    const fields = remediationFields.parse({
      pullRequestUrl: 'https://github.com/team/repo/pull/42',
      fixedCommit: SHA,
      testResult: 'passed',
      testEvidence: 'pnpm test passed',
      deployedCommit: SHA,
      deploymentUrl: 'https://example.com/deployments/42',
      deploymentNote: 'Production verified after deployment',
    });
    const report = await service.save('owner', finding.id, { revision: 0, fields });
    expect(report.revision).toBe(1);
    expect(report.verification.tests.provenance).toBe('team_reported');
    expect(report.verification.deployment.matchesAssessedFix).toBe(false);
    expect(report.history[0]?.record).toMatchObject({ fields: { fixedCommit: SHA } });
    expect(finding.status).toBe('open');
  });
  it('supports GitLab.com merge request references', async () => {
    const { service, source } = setup();
    source.provider = 'gitlab';
    source.repositoryUrl = 'https://gitlab.com/group/team/repo';
    await expect(
      service.save('owner', 'finding-1', {
        revision: 0,
        fields: remediationFields.parse({
          pullRequestUrl: 'https://gitlab.com/group/team/repo/-/merge_requests/2',
        }),
      }),
    ).resolves.toMatchObject({ revision: 1 });
  });
  it('rejects stale revision writes instead of overwriting another team member', async () => {
    const { service, finding } = setup();
    finding.remediationRevision = 2;
    await expect(
      service.save('owner', finding.id, { revision: 0, fields: remediationFields.parse({}) }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(finding.events).toHaveLength(0);
  });
  it('checks the current repository and never closes a finding automatically', async () => {
    const { service, sync, finding } = setup();
    const report = await service.recheck('owner', finding.id, 0);
    expect(sync).toHaveBeenCalledWith('owner', 'source-1');
    expect(report.verification.inventory).toBe('clear');
    expect(finding.status).toBe('open');
    expect(report.recheck?.commit).toBe(SHA);
  });
  it('matches advisory aliases at a different installed version', async () => {
    const { service, provider } = setup();
    provider.scan.mockResolvedValue({
      matches: [
        {
          advisory: { ...advisory, id: 'OSV-alias', aliases: ['CVE-2026-12345'] },
          packageName: 'example',
          ecosystem: 'npm',
          installedVersion: '1.0.1',
        },
      ],
      warnings: [],
      sources: [{ name: 'OSV', status: 'healthy', checkedAt: NOW.toISOString() }],
      scannedAt: NOW.toISOString(),
    });
    expect((await service.recheck('owner', 'finding-1', 0)).verification.inventory).toBe(
      'affected',
    );
  });
  it('treats source failures, missing OSV coverage, and inventory warnings as incomplete', async () => {
    for (const kind of ['throw', 'missing', 'warnings', 'empty']) {
      const { service, provider, project } = setup();
      if (kind === 'throw')
        provider.scan.mockRejectedValue(new Error('internal connection details'));
      if (kind === 'missing')
        provider.scan.mockResolvedValue({
          matches: [],
          sources: [],
          warnings: [],
          scannedAt: NOW.toISOString(),
        });
      if (kind === 'warnings') project.warnings = ['Inventory partly parsed'];
      if (kind === 'empty') project.packages = [];
      const report = await service.recheck('owner', 'finding-1', 0);
      expect(report.verification.inventory).toBe('incomplete');
      expect(JSON.stringify(report)).not.toContain('internal connection details');
    }
  });
  it('replaces an earlier clear result when a subsequent check fails', async () => {
    const { service, provider } = setup();
    await service.recheck('owner', 'finding-1', 0);
    provider.scan.mockRejectedValue(new Error('outage'));
    expect((await service.recheck('owner', 'finding-1', 1)).verification.inventory).toBe(
      'incomplete',
    );
  });
  it('marks evidence stale when inventory, advisory, source access or age changes', async () => {
    for (const kind of ['inventory', 'advisory', 'paused', 'syncing', 'outage', 'age']) {
      const { service, project, source, finding, tick } = setup();
      await service.recheck('owner', 'finding-1', 0);
      if (kind === 'inventory') project.inventoryRevision = 'changed';
      if (kind === 'advisory') finding.advisory.data.modifiedAt = '2026-11-24T12:00:00Z';
      if (kind === 'paused') source.paused = true;
      if (kind === 'syncing') source.observedCommit = 'b'.repeat(40);
      if (kind === 'outage') project.scanError = 'failed' as never;
      if (kind === 'age') tick(24 * 60 * 60 * 1000 + 1);
      expect((await service.get('owner', 'finding-1')).verification.inventory).toBe('stale');
    }
  });
  it('rejects a check when the inventory changes during the source lookup', async () => {
    const { service, provider, project } = setup();
    provider.scan.mockImplementation(async () => {
      project.inventoryRevision = 'changed';
      return { matches: [], sources: [], warnings: [], scannedAt: NOW.toISOString() };
    });
    await expect(service.recheck('owner', 'finding-1', 0)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it('blocks rechecks for disconnected or paused repository sources', async () => {
    for (const state of ['disconnected', 'paused']) {
      const { service, source, provider } = setup();
      if (state === 'disconnected') source.status = state;
      else source.paused = true;
      await expect(service.recheck('owner', 'finding-1', 0)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(provider.scan).not.toHaveBeenCalled();
    }
  });
});
