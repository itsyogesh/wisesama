import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { organizationFixture } from '../../../services/__tests__/organization-fixture';
import type { IntelAdvisory } from '../../../services/intel/index';
import { projectScope } from '../../../services/organization-access';

vi.mock('@wisesama/database', () => ({ prisma: {}, Prisma: { DbNull: null } }));

import {
  createIntelWorkspaceService,
  sendIntelEmail,
} from '../../../services/intel-workspace.service';

const NOW = new Date('2026-11-04T10:00:00.000Z');
const project = {
  id: 'project-1',
  userId: 'owner',
  organizationId: 'org-1',
  name: 'Checkout',
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
const advisory: IntelAdvisory = {
  id: 'GHSA-example',
  aliases: ['CVE-2026-12345'],
  title: 'Example vulnerability',
  summary: 'A test-only advisory.',
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

function setup() {
  const access = organizationFixture('owner');
  const db = {
    organizationMember: access.organizationMember,
    intelAdvisoryReview: { findMany: vi.fn().mockResolvedValue([]) },
    projectRepositorySource: { findFirst: vi.fn().mockResolvedValue(null) },
    securityProject: {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          access.projectMatches(where, project) ? project : null,
        ),
      findMany: vi.fn().mockResolvedValue([project]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(project),
    },
    securityAdvisory: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: advisory.id, data: advisory }),
    },
    securityFinding: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({ id: 'finding-1', status: 'open' }),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    securityFindingEvent: { create: vi.fn() },
    securityNotificationSettings: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'owner', emailEnabled: true }),
      upsert: vi.fn(),
    },
    securityDelivery: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: 'owner@example.org', emailVerified: true }),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  const provider = {
    scan: vi
      .fn()
      .mockResolvedValue({ matches: [], warnings: [], sources: [], scannedAt: NOW.toISOString() }),
    getBriefings: vi
      .fn()
      .mockResolvedValue({ advisories: [], sources: [], fetchedAt: NOW.toISOString() }),
  };
  const mail = vi.fn().mockResolvedValue({ status: 'sent', messageId: 'provider-1' });
  const service = createIntelWorkspaceService({
    db: db as unknown as PrismaClient,
    provider,
    mail,
    now: () => NOW,
  });
  return { db, provider, mail, service, access };
}

describe('security workspace ownership and scans', () => {
  it('requires detaching a repository source before a manual inventory replacement', async () => {
    const { db, service } = setup();
    db.projectRepositorySource.findFirst.mockResolvedValue({ id: 'source-1' });
    await expect(
      service.updateInventory('owner', 'project-1', {
        inventory: {
          format: 'inventory',
          content: '[{"name":"example","version":"1.0.0","ecosystem":"npm"}]',
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
    expect(db.projectRepositorySource.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        project: projectScope('owner', 'manage'),
        status: { not: 'disconnected' },
      },
      select: { id: true },
    });
  });
  it('does not query upstream sources or write another account’s project', async () => {
    const { db, provider, service } = setup();
    db.securityProject.findFirst.mockResolvedValue(null);
    await expect(service.scanProject('intruder', 'project-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.securityProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'project-1', ...projectScope('intruder') } }),
    );
    expect(provider.scan).not.toHaveBeenCalled();
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
  });

  it('keeps existing findings unchanged when upstream matching fails', async () => {
    const { db, provider, service } = setup();
    provider.scan.mockRejectedValue(new Error('upstream unavailable'));
    await expect(service.scanProject('owner', 'project-1')).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(db.securityFinding.upsert).not.toHaveBeenCalled();
    expect(db.securityFinding.update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.securityProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { scanToken: null, scanStartedAt: null } }),
    );
    expect(
      db.securityProject.updateMany.mock.calls.some(([query]) => query.data.lastScannedAt),
    ).toBe(false);
  });

  it('rejects overlapping scans instead of sending duplicate alerts', async () => {
    const { db, provider, service } = setup();
    db.securityProject.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.scanProject('owner', 'project-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(provider.scan).not.toHaveBeenCalled();
  });

  it('discards results if inventory changed while sources were being queried', async () => {
    const { db, service } = setup();
    db.securityProject.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });
    await expect(service.scanProject('owner', 'project-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.securityFinding.upsert).not.toHaveBeenCalled();
  });

  it('does not automatically close findings absent from a new scan', async () => {
    const { db, service } = setup();
    await service.scanProject('owner', 'project-1');
    expect(db.securityFinding.update).not.toHaveBeenCalled();
    expect(db.securityFinding.upsert).not.toHaveBeenCalled();
  });

  it('does not queue email for an unverified address', async () => {
    const { db, provider, service } = setup();
    db.user.findUnique.mockResolvedValue({ email: 'owner@example.org', emailVerified: false });
    provider.scan.mockResolvedValue({
      matches: [
        {
          advisory,
          ecosystem: 'npm',
          packageName: 'example',
          installedVersion: '1.0.0',
          fixedVersion: '1.0.1',
        },
      ],
      warnings: [],
      sources: [],
      scannedAt: NOW.toISOString(),
    });
    await service.scanProject('owner', 'project-1');
    expect(db.securityFinding.upsert).toHaveBeenCalledOnce();
    expect(db.securityDelivery.upsert).not.toHaveBeenCalled();
  });

  it('deduplicates queued alert events by meaningful match state', async () => {
    const { db, provider, service } = setup();
    provider.scan.mockResolvedValue({
      matches: [
        {
          advisory,
          ecosystem: 'npm',
          packageName: 'example',
          installedVersion: '1.0.0',
          fixedVersion: '1.0.1',
        },
      ],
      warnings: [],
      sources: [],
      scannedAt: NOW.toISOString(),
    });
    await service.scanProject('owner', 'project-1');
    await service.scanProject('owner', 'project-1');
    const first = db.securityDelivery.upsert.mock.calls[0]?.[0];
    const second = db.securityDelivery.upsert.mock.calls[1]?.[0];
    expect(first.where.eventKey).toBe(second.where.eventKey);
    expect(first.update).toEqual({});
    expect(first.create.body).toContain('Exposure in your deployment is unverified.');
  });
});

describe('response evidence', () => {
  it('requires ownership before editing a finding', async () => {
    const { db, service } = setup();
    await expect(
      service.updateFinding('intruder', 'finding-1', { status: 'investigating' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.securityFinding.findFirst).toHaveBeenCalledWith({
      where: { id: 'finding-1', project: projectScope('intruder', 'contribute') },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    'resolved',
    'not_affected',
  ] as const)('requires evidence when setting %s', async (status) => {
    const { db, service } = setup();
    db.securityFinding.findFirst.mockResolvedValue({ id: 'finding-1', status: 'open' });
    await expect(
      service.updateFinding('owner', 'finding-1', { status, evidence: '  done  ' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('opt-in email delivery', () => {
  const delivery = {
    id: 'delivery-1',
    userId: 'owner',
    projectId: 'project-1',
    eventKey: 'event-1',
    subject: 'Relevant security update',
    body: 'Details',
    status: 'pending',
    attempts: 0,
    nextAttemptAt: NOW,
    claimedAt: null,
    createdAt: NOW,
    sentAt: null,
    error: null,
  };

  it('rechecks consent at send time and skips opted-out users', async () => {
    const { db, mail, service } = setup();
    db.securityDelivery.findMany.mockResolvedValue([delivery]);
    db.securityDelivery.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...delivery, ...data }),
    );
    db.securityNotificationSettings.findUnique.mockResolvedValue({ emailEnabled: false });
    const results = await service.processDeliveries('owner');
    expect(mail).not.toHaveBeenCalled();
    expect(results[0]?.status).toBe('skipped');
  });

  it('sends only to the verified account address looked up at delivery time', async () => {
    const { db, mail, service } = setup();
    db.securityDelivery.findMany.mockResolvedValue([delivery]);
    db.securityDelivery.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...delivery, ...data }),
    );
    await service.processDeliveries('owner');
    expect(mail).toHaveBeenCalledWith({
      to: 'owner@example.org',
      subject: delivery.subject,
      text: delivery.body,
      idempotencyKey: 'event-1',
    });
  });

  it('reports unavailable provider configuration without a fake success', async () => {
    const { db, mail, service } = setup();
    db.securityDelivery.findMany.mockResolvedValue([delivery]);
    db.securityDelivery.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...delivery, ...data }),
    );
    mail.mockResolvedValue({ status: 'unavailable', error: 'Email delivery is not configured.' });
    const results = await service.processDeliveries('owner');
    expect(results[0]?.status).toBe('unavailable');
    expect(results[0]?.sentAt).toBeNull();
    expect(db.securityDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ attempts: { decrement: 1 } }) }),
    );
  });

  it('does not send if another worker has claimed the delivery', async () => {
    const { db, mail, service } = setup();
    db.securityDelivery.findMany.mockResolvedValue([delivery]);
    db.securityDelivery.updateMany.mockResolvedValue({ count: 0 });
    await service.processDeliveries('owner');
    expect(mail).not.toHaveBeenCalled();
  });

  it('rechecks suspension at delivery time and never mails a newly suspended owner', async () => {
    const { db, mail, service } = setup();
    db.securityDelivery.findMany.mockResolvedValue([delivery]);
    db.securityDelivery.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...delivery, ...data }),
    );
    db.user.findUnique.mockResolvedValue({
      email: 'owner@example.org',
      emailVerified: true,
      intelSuspendedAt: NOW,
    });
    await service.processDeliveries('owner', 1, delivery.id);
    expect(mail).not.toHaveBeenCalled();
    expect(db.securityDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: delivery.id, user: { intelSuspendedAt: null } }),
      }),
    );
    expect(db.securityDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'skipped',
          error: 'Wisesama workspace access is suspended.',
        }),
      }),
    );
  });

  it('refuses to enable alerts before account email verification', async () => {
    const { db, service } = setup();
    db.user.findUnique.mockResolvedValue({ email: 'owner@example.org', emailVerified: false });
    await expect(service.updateNotificationSettings('owner', true)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.securityNotificationSettings.upsert).not.toHaveBeenCalled();
  });

  it('never calls Resend without an API key', async () => {
    const previous = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      await expect(
        sendIntelEmail({
          to: 'owner@example.org',
          subject: 'Test',
          text: 'Test',
          idempotencyKey: 'test',
        }),
      ).resolves.toEqual({ status: 'unavailable', error: 'Email delivery is not configured.' });
    } finally {
      if (previous) process.env.RESEND_API_KEY = previous;
    }
  });
});

describe('organization workspace boundaries', () => {
  it('scopes workspace data to the requested organization and retains personal alert settings', async () => {
    const { db, service, access } = setup();
    access.members.set('teammate', 'member');
    const result = await service.getWorkspace('teammate', 'org-1');
    expect(result.projects[0]?.organizationId).toBe('org-1');
    expect(db.securityProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: projectScope('teammate', 'read', 'org-1') }),
    );
    expect(db.securityFinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project: projectScope('teammate', 'read', 'org-1') } }),
    );
    expect(db.securityNotificationSettings.findUnique).toHaveBeenCalledWith({
      where: { userId: 'teammate' },
    });
    await expect(service.getWorkspace('teammate', 'org-other')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
  it('rejects member inventory and project creation before mutation', async () => {
    const { db, service, access } = setup();
    access.members.set('teammate', 'member');
    await expect(
      service.updateInventory('teammate', 'project-1', {
        inventory: { format: 'inventory', content: '[]' },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.createProject('teammate', {
        organizationId: 'org-1',
        name: 'Test',
        environment: 'development',
        inventory: { format: 'inventory', content: '[]' },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.projectRepositorySource.findFirst).not.toHaveBeenCalled();
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
    expect(db.securityProject.create).not.toHaveBeenCalled();
  });
  it('lets members reassess the shared project but stops an in-flight assessment after removal', async () => {
    const { db, provider, service, access } = setup();
    access.members.set('teammate', 'member');
    await service.scanProject('teammate', 'project-1');
    expect(provider.scan).toHaveBeenCalledOnce();
    expect(db.securityNotificationSettings.findUnique).toHaveBeenCalledWith({
      where: { userId: 'owner' },
    });
    db.securityFinding.upsert.mockClear();
    provider.scan.mockImplementation(async () => {
      access.members.delete('teammate');
      return { matches: [], warnings: [], sources: [], scannedAt: NOW.toISOString() };
    });
    await expect(service.scanProject('teammate', 'project-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.securityFinding.upsert).not.toHaveBeenCalled();
  });
  it('skips queued organization email after its original recipient loses membership', async () => {
    const { db, mail, service, access } = setup();
    const delivery = {
      id: 'revoked-alert',
      userId: 'owner',
      projectId: 'project-1',
      eventKey: 'revoked-alert',
      subject: 'Private alert',
      body: 'Private project details',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: NOW,
      claimedAt: null,
      createdAt: NOW,
      sentAt: null,
      error: null,
    };
    db.securityDelivery.findMany.mockResolvedValue([delivery]);
    db.securityDelivery.update.mockImplementation(async ({ data }) => ({ ...delivery, ...data }));
    access.members.delete('owner');
    const result = await service.processDeliveries();
    expect(mail).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      status: 'skipped',
      error: 'The alert recipient no longer has access to this organization.',
    });
  });
  it('requires current organization access before private finding evidence is edited', async () => {
    const { db, service, access } = setup();
    const finding = {
      id: 'finding-1',
      projectId: 'project-1',
      advisory: { data: advisory },
      project: { name: project.name },
      packageName: 'example',
      ecosystem: 'npm',
      installedVersion: '1.0.0',
      fixedVersion: null,
      status: 'open',
      note: '',
      evidence: '',
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      resolvedAt: null,
      events: [],
    };
    access.members.set('teammate', 'member');
    db.securityFinding.findFirst.mockImplementation(async ({ where }) =>
      access.projectMatches(where.project, project) ? finding : null,
    );
    await service.updateFinding('teammate', 'finding-1', {
      status: 'investigating',
      note: 'Reviewing the shared evidence',
    });
    expect(db.securityFindingEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorId: 'teammate' }) }),
    );
    db.securityFindingEvent.create.mockClear();
    access.members.delete('teammate');
    await expect(
      service.updateFinding('teammate', 'finding-1', { status: 'investigating' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.securityFindingEvent.create).not.toHaveBeenCalled();
  });
});

describe('scheduled assessment revocation', () => {
  it('defers a removed creator for 24 hours without scanning or changing retained findings and evidence', async () => {
    const { db, provider, service, access } = setup();
    access.members.delete('owner');
    const result = await service.runScheduledScans();
    expect(result.projects).toEqual([{ projectId: 'project-1', status: 'access_removed' }]);
    expect(provider.scan).not.toHaveBeenCalled();
    expect(db.securityProject.updateMany).toHaveBeenCalledExactlyOnceWith({
      where: {
        id: 'project-1',
        userId: 'owner',
        organizationId: 'org-1',
        nextScanAt: { lte: NOW },
      },
      data: { nextScanAt: new Date(NOW.getTime() + 24 * 60 * 60_000) },
    });
    expect(db.securityFinding.upsert).not.toHaveBeenCalled();
    expect(db.securityFinding.updateMany).not.toHaveBeenCalled();
    access.members.set('teammate', 'member');
    await service.scanProject('teammate', 'project-1');
    expect(provider.scan).toHaveBeenCalledOnce();
    expect(db.securityDelivery.upsert).not.toHaveBeenCalled();
  });
});
