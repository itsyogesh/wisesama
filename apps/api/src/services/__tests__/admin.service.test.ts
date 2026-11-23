import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { adminSafeError, createIntelAdminService } from '../admin.service';

const now = new Date('2026-11-05T10:00:00Z');
const user = () => ({
  id: 'target',
  email: 'target@example.invalid',
  name: 'Test user',
  emailVerified: true,
  intelAdmin: false,
  intelSuspendedAt: null,
  intelSuspensionReason: '',
  intelRevision: 0,
  createdAt: now,
  updatedAt: now,
  _count: { securityProjects: 1, repositoryConnections: 1 },
  accounts: [{ password: 'NEVER_EXPOSE' }],
  sessions: [{ token: 'NEVER_EXPOSE' }],
});
const advisory = () => ({
  id: 'GHSA-test',
  aliases: ['CVE-2026-12345'],
  data: { title: 'Synthetic advisory', summary: 'Test source facts', severity: 'high' },
  fetchedAt: now,
  adminReview: null,
});
const subscriber = () => ({
  id: 'subscriber-1',
  email: 'subscriber@example.invalid',
  status: 'active',
  topics: ['all'],
  confirmedAt: now,
  nextDigestAt: now,
  createdAt: now,
  updatedAt: now,
  adminRevision: 0,
  unsubscribeVersion: 1,
  tokens: [{ token: 'NEVER_EXPOSE' }],
});
function harness() {
  const db = {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'operator' }),
      findUnique: vi.fn().mockResolvedValue(user()),
      findMany: vi.fn().mockResolvedValue([user()]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
    },
    projectRepositorySource: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    securityProject: { findMany: vi.fn().mockResolvedValue([]) },
    securityDelivery: { findMany: vi.fn().mockResolvedValue([]) },
    securityAdvisory: {
      findUnique: vi.fn().mockResolvedValue(advisory()),
      findMany: vi.fn().mockResolvedValue([advisory()]),
      updateMany: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
    },
    intelAdvisoryReview: {
      upsert: vi.fn(),
      findUnique: vi
        .fn()
        .mockResolvedValue({ visibility: 'published', guidance: '', note: '', revision: 0 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    intelAdminAudit: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    publicSubscriber: {
      findUnique: vi.fn().mockResolvedValue(subscriber()),
      findMany: vi.fn().mockResolvedValue([subscriber()]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
    },
    publicSubscriptionToken: { deleteMany: vi.fn() },
    publicFeedDelivery: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    publicMailReceipt: { findMany: vi.fn().mockResolvedValue([]) },
    publicMailWebhook: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return {
    db,
    service: createIntelAdminService({ db: db as unknown as PrismaClient, now: () => now }),
  };
}
const reason = 'Investigated customer support request';
describe('Wisesama operator actions', () => {
  it('projects user diagnostics without accounts, secrets, inventories or session tokens', async () => {
    const { service } = harness();
    expect(JSON.stringify(await service.user('target'))).not.toContain('NEVER_EXPOSE');
    expect(JSON.stringify(await service.users())).not.toContain('NEVER_EXPOSE');
    expect(JSON.stringify(await service.subscription('subscriber-1'))).not.toContain(
      'NEVER_EXPOSE',
    );
  });
  it('prevents self/administrator suspension without altering shared identity roles', async () => {
    const { db, service } = harness();
    await expect(
      service.access('operator', 'operator', { suspended: true, expectedRevision: 0, reason }),
    ).rejects.toMatchObject({ statusCode: 409 });
    db.user.findUnique.mockResolvedValue({ ...user(), intelAdmin: true });
    await expect(
      service.access('operator', 'target', { suspended: true, expectedRevision: 0, reason }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it('checks actor privilege inside a mutation transaction', async () => {
    const { db, service } = harness();
    db.user.findFirst.mockResolvedValue(null);
    await expect(
      service.access('revoked', 'target', { suspended: true, expectedRevision: 0, reason }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(db.intelAdminAudit.create).not.toHaveBeenCalled();
  });
  it('records v2-only suspension and an audit in the same transaction', async () => {
    const { db, service } = harness();
    await service.access('operator', 'target', { suspended: true, expectedRevision: 0, reason });
    expect(db.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'target', intelRevision: 0, intelAdmin: false },
      data: {
        intelSuspendedAt: now,
        intelSuspensionReason: reason,
        intelRevision: { increment: 1 },
      },
    });
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'target' },
        data: expect.objectContaining({
          paused: true,
          status: 'access_removed',
          syncToken: null,
          baselineToken: null,
        }),
      }),
    );
    expect(db.intelAdminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'user.suspend',
          targetId: 'target',
          metadata: expect.objectContaining({ scope: 'wisesama_v2' }),
        }),
      }),
    );
  });
  it('never appends a successful audit for a stale revision', async () => {
    const { db, service } = harness();
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.access('operator', 'target', { suspended: false, expectedRevision: 0, reason }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminAudit.create).not.toHaveBeenCalled();
  });
  it('stores editorial context separately and never mutates authoritative source facts', async () => {
    const { db, service } = harness();
    await service.review('operator', 'GHSA-test', {
      expectedRevision: 0,
      visibility: 'hidden',
      guidance: 'Curated contextual response guidance',
      note: 'Internal review note',
      reason,
    });
    expect(db.securityAdvisory.updateMany).not.toHaveBeenCalled();
    expect(db.intelAdvisoryReview.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibility: 'hidden', revision: { increment: 1 } }),
      }),
    );
    const audit = JSON.stringify(db.intelAdminAudit.create.mock.calls);
    expect(audit).not.toContain('Curated contextual response guidance');
    expect(audit).not.toContain('Internal review note');
  });
  it('rejects source review overwrites when another operator saved first', async () => {
    const { db, service } = harness();
    db.intelAdvisoryReview.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.review('operator', 'GHSA-test', {
        expectedRevision: 0,
        visibility: 'published',
        guidance: '',
        note: '',
        reason,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminAudit.create).not.toHaveBeenCalled();
  });
  it('cannot activate or unsuppress subscriptions even through the service edge', async () => {
    const { db, service } = harness();
    await expect(
      service.subscriptionStatus('operator', 'subscriber-1', {
        status: 'active' as 'suppressed',
        expectedRevision: 0,
        reason,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    db.publicSubscriber.findUnique.mockResolvedValue({ ...subscriber(), status: 'suppressed' });
    await expect(
      service.subscriptionStatus('operator', 'subscriber-1', {
        status: 'unsubscribed',
        expectedRevision: 0,
        reason,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.publicSubscriber.updateMany).not.toHaveBeenCalled();
    expect(db.publicSubscriptionToken.deleteMany).not.toHaveBeenCalled();
  });
  it('stops future mail, invalidates consent tokens, and records intent without fabricating consent', async () => {
    const { db, service } = harness();
    await service.subscriptionStatus('operator', 'subscriber-1', {
      status: 'unsubscribed',
      expectedRevision: 0,
      reason,
    });
    expect(db.publicSubscriber.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'unsubscribed',
          nextDigestAt: null,
          unsubscribeVersion: { increment: 1 },
          adminRevision: { increment: 1 },
        }),
      }),
    );
    expect(db.publicSubscriptionToken.deleteMany).toHaveBeenCalledWith({
      where: { subscriberId: 'subscriber-1' },
    });
    expect(db.publicFeedDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          subscriberId: 'subscriber-1',
          status: { in: ['pending', 'failed', 'unavailable'] },
        },
      }),
    );
    expect(JSON.stringify(db.publicSubscriber.updateMany.mock.calls)).not.toContain('confirmedAt');
  });
  it('invalid cursors are rejected and stable same-time pages carry an ID boundary', async () => {
    const { db, service } = harness();
    await expect(service.users({ cursor: 'garbage' })).rejects.toMatchObject({ statusCode: 400 });
    db.user.findMany.mockResolvedValue([
      { ...user(), id: 'z' },
      { ...user(), id: 'y' },
    ]);
    const first = await service.users({ limit: 1 });
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    await service.users({ limit: 1, cursor: first.nextCursor! });
    expect(db.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: [{ createdAt: { lt: now } }, { createdAt: now, id: { lt: 'z' } }],
            }),
          ]),
        }),
      }),
    );
  });
  it('redacts credential-like errors instead of passing arbitrary provider diagnostics through', () => {
    const error = adminSafeError(
      'Provider rejected https://user:secret@example.invalid/path?token=secret Authorization: Bearer private-value token=private-value',
    );
    expect(error).not.toContain('private-value');
    expect(error).not.toContain('user:secret');
  });
});
