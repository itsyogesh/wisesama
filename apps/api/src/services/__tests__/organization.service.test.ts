import { createHash } from 'node:crypto';
import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { createOrganizationService } from '../organization.service';
import {
  ensurePersonalOrganization,
  isActiveOrganizationMember,
  projectScope,
  requireOrganizationAccess,
  requireProjectAccess,
} from '../organization-access';

const now = new Date('2026-11-05T11:00:00Z');
const token = 'synthetic_invitation_token_with_32_bytes_123456';
const organization = () => ({
  id: 'org-1',
  name: 'Example',
  personalForUserId: null,
  createdById: 'actor',
  revision: 3,
  createdAt: now,
  updatedAt: now,
  _count: { members: 2, projects: 1 },
});
const invitation = () => ({
  id: 'invite-1',
  organizationId: 'org-1',
  email: 'invitee@example.invalid',
  role: 'member',
  tokenHash: createHash('sha256').update(token).digest('hex'),
  status: 'pending',
  revision: 2,
  createdById: 'actor',
  acceptedById: null,
  acceptedAt: null,
  createdAt: now,
  updatedAt: now,
  expiresAt: new Date(now.getTime() + 86_400_000),
  organization: { name: 'Example' },
});
const membership = (role = 'owner') => ({
  id: 'actor-membership',
  organizationId: 'org-1',
  userId: 'actor',
  role,
  revision: 2,
  createdAt: now,
  updatedAt: now,
  organization: organization(),
});
function harness() {
  const db = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'invitee',
        name: 'Invitee',
        email: 'invitee@example.invalid',
        emailVerified: true,
        intelSuspendedAt: null,
      }),
    },
    organization: {
      findUnique: vi.fn().mockResolvedValue(organization()),
      findMany: vi.fn().mockResolvedValue([organization()]),
      upsert: vi.fn().mockResolvedValue(organization()),
      create: vi.fn().mockResolvedValue(organization()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    organizationMember: {
      findFirst: vi.fn().mockResolvedValue(membership()),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(2),
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    organizationInvitation: {
      findUnique: vi.fn().mockResolvedValue(invitation()),
      findFirst: vi.fn().mockResolvedValue(invitation()),
      findMany: vi.fn().mockResolvedValue([invitation()]),
      create: vi.fn().mockImplementation(async ({ data }) => ({ ...invitation(), ...data })),
      update: vi.fn().mockResolvedValue(invitation()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    organizationAudit: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    projectRepositorySource: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    securityProject: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'project-1', userId: 'original-owner', organizationId: 'org-1' }),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  return {
    db,
    service: createOrganizationService({
      db: db as unknown as PrismaClient,
      now: () => now,
      appUrl: 'https://wisesama.example',
      token: () => token,
    }),
  };
}
const input = { expectedRevision: 2, reason: 'Team responsibilities changed' };

describe('live organization boundaries', () => {
  it('filters projects by current membership and suspension, never original creator alone', () => {
    const scope = projectScope('actor', 'manage', 'org-1');
    expect(scope).toEqual({
      organization: {
        id: 'org-1',
        members: {
          some: {
            userId: 'actor',
            role: { in: ['owner', 'admin'] },
            user: { intelSuspendedAt: null },
          },
        },
      },
    });
    expect(JSON.stringify(scope)).not.toContain('original-owner');
  });
  it('denies another organization before project data or member data is queried', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst.mockResolvedValue(null);
    await expect(service.get('outsider', 'org-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(db.organizationMember.findMany).not.toHaveBeenCalled();
    expect(db.organizationInvitation.findMany).not.toHaveBeenCalled();
    db.securityProject.findFirst.mockResolvedValue(null);
    await expect(
      requireProjectAccess(db as unknown as PrismaClient, 'outsider', 'project-1'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.securityProject.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1', ...projectScope('outsider') },
    });
  });
  it('lets members contribute but blocks configuration and checks original connector membership live', async () => {
    const { db } = harness();
    db.organizationMember.findFirst.mockResolvedValue(membership('member'));
    await expect(
      requireProjectAccess(db as unknown as PrismaClient, 'actor', 'project-1', 'contribute'),
    ).resolves.toMatchObject({ userId: 'original-owner' });
    await expect(
      requireOrganizationAccess(db as unknown as PrismaClient, 'actor', 'org-1', 'manage'),
    ).rejects.toMatchObject({ statusCode: 403 });
    db.organizationMember.findFirst.mockResolvedValue(null);
    expect(
      await isActiveOrganizationMember(db as unknown as PrismaClient, 'original-owner', 'org-1'),
    ).toBe(false);
    expect(db.organizationMember.findFirst).toHaveBeenLastCalledWith({
      where: {
        organizationId: 'org-1',
        userId: 'original-owner',
        role: { in: ['owner', 'admin', 'member'] },
        user: { intelSuspendedAt: null },
      },
      select: { id: true },
    });
  });
  it('withholds pending invitations and audit from ordinary members', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst.mockResolvedValue(membership('member'));
    const result = await service.get('actor', 'org-1');
    expect(result.canManage).toBe(false);
    expect(result.invitations).toEqual([]);
    expect(result.audit).toEqual([]);
    expect(db.organizationInvitation.findMany).not.toHaveBeenCalled();
    expect(db.organizationAudit.findMany).not.toHaveBeenCalled();
  });
  it('creates a unique personal workspace and owner atomically and retries a concurrent first visit', async () => {
    const { db } = harness();
    db.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    await ensurePersonalOrganization(db as unknown as PrismaClient, 'invitee');
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(db.$transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(db.organization.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { personalForUserId: 'invitee' },
        create: expect.objectContaining({
          personalForUserId: 'invitee',
          members: { create: expect.objectContaining({ userId: 'invitee', role: 'owner' }) },
        }),
      }),
    );
  });
});

describe('organization management concurrency and role policy', () => {
  it('rechecks actor membership within the write transaction', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst.mockResolvedValue(null);
    await expect(
      service.changeMember('removed-actor', 'org-1', 'target', { ...input, role: 'admin' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.organizationMember.updateMany).not.toHaveBeenCalled();
    expect(db.organizationAudit.create).not.toHaveBeenCalled();
  });
  it('prevents admin ownership changes and self changes', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst
      .mockResolvedValueOnce(membership('admin'))
      .mockResolvedValueOnce({ ...membership('member'), id: 'target-member', userId: 'target' });
    await expect(
      service.changeMember('actor', 'org-1', 'target-member', { ...input, role: 'owner' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    db.organizationMember.findFirst.mockResolvedValue(membership());
    await expect(
      service.removeMember('actor', 'org-1', 'actor-membership', input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.organizationMember.updateMany).not.toHaveBeenCalled();
    expect(db.organizationMember.deleteMany).not.toHaveBeenCalled();
  });
  it('blocks stale member revisions before any writes', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst.mockResolvedValueOnce(membership()).mockResolvedValueOnce({
      ...membership(),
      id: 'target-member',
      userId: 'target',
      revision: 4,
    });
    await expect(
      service.changeMember('actor', 'org-1', 'target-member', { ...input, role: 'member' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.organization.updateMany).not.toHaveBeenCalled();
    expect(db.organizationMember.updateMany).not.toHaveBeenCalled();
  });
  it('protects the last active owner', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst
      .mockResolvedValueOnce(membership())
      .mockResolvedValueOnce({ ...membership(), id: 'target-member', userId: 'target' });
    db.organizationMember.count.mockResolvedValue(0);
    await expect(
      service.removeMember('actor', 'org-1', 'target-member', input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.organizationMember.deleteMany).not.toHaveBeenCalled();
  });
  it('serializes changes through an organization revision write and commits an audit alongside the role', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst
      .mockResolvedValueOnce(membership())
      .mockResolvedValueOnce({ ...membership('member'), id: 'target-member', userId: 'target' });
    await service.changeMember('actor', 'org-1', 'target-member', { ...input, role: 'admin' });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(db.organization.updateMany).toHaveBeenCalledWith({
      where: { id: 'org-1', revision: 3 },
      data: { revision: { increment: 1 } },
    });
    expect(db.organizationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'member.role_changed',
        actorId: 'actor',
        targetUserId: 'target',
        metadata: { previousRole: 'member', role: 'admin' },
      }),
    });
    expect(db.organizationMember.updateMany).toHaveBeenCalledWith({
      where: { id: 'target-member', organizationId: 'org-1', revision: 2 },
      data: { role: 'admin', revision: { increment: 1 } },
    });
  });
  it('returns a conflict after a concurrent transaction, rather than retrying a stale role write', async () => {
    const { db, service } = harness();
    db.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(
      service.removeMember('actor', 'org-1', 'target-member', input),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('pauses only the removed connector’s sources in this organization and clears in-flight leases', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst
      .mockResolvedValueOnce(membership())
      .mockResolvedValueOnce({ ...membership('member'), id: 'target-member', userId: 'target' });
    await service.removeMember('actor', 'org-1', 'target-member', input);
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith({
      where: { userId: 'target', project: { organizationId: 'org-1' } },
      data: {
        paused: true,
        status: 'access_removed',
        error: expect.stringContaining('no longer an organization member'),
        syncToken: null,
        syncStartedAt: null,
        baselineToken: null,
        baselineStartedAt: null,
      },
    });
    expect(JSON.stringify(db.projectRepositorySource.updateMany.mock.calls)).not.toContain(
      'inventoryDigest',
    );
    expect(db.organizationAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'member.removed', targetUserId: 'target' }),
    });
  });
});

describe('verified, revocable invitation acceptance', () => {
  it('returns the raw link only on creation, while persisting only a digest', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst.mockResolvedValueOnce(membership()).mockResolvedValueOnce(null);
    db.organizationInvitation.findUnique.mockResolvedValue(null);
    const result = await service.invite('actor', 'org-1', {
      email: 'Invitee@Example.Invalid',
      role: 'member',
    });
    expect(result.inviteUrl).toBe(`https://wisesama.example/invite?token=${token}`);
    expect(result.delivery).toBe('share_link');
    expect(JSON.stringify(result.invitation)).not.toContain(token);
    expect(JSON.stringify(db.organizationInvitation.create.mock.calls)).not.toContain(token);
    expect(db.organizationInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: createHash('sha256').update(token).digest('hex'),
          email: 'invitee@example.invalid',
          expiresAt: new Date(now.getTime() + 7 * 86_400_000),
        }),
      }),
    );
  });
  it('does not consume a public GET or disclose the invitee email/hash', async () => {
    const { db, service } = harness();
    const result = await service.invitation(token);
    expect(result).toEqual({
      invitation: {
        organizationName: 'Example',
        role: 'member',
        expiresAt: invitation().expiresAt.toISOString(),
        status: 'pending',
      },
    });
    expect(JSON.stringify(result)).not.toContain('invitee@example.invalid');
    expect(db.organizationInvitation.updateMany).not.toHaveBeenCalled();
    expect(db.organizationMember.create).not.toHaveBeenCalled();
  });
  it.each([
    ['expired', { expiresAt: new Date(now.getTime() - 1) }, 409],
    ['revoked', { status: 'revoked' }, 409],
    ['accepted', { status: 'accepted' }, 409],
  ])('rejects %s invitations without adding membership', async (_label, override, code) => {
    const { db, service } = harness();
    db.organizationInvitation.findUnique.mockResolvedValue({ ...invitation(), ...override });
    await expect(service.acceptInvitation('invitee', token)).rejects.toMatchObject({
      statusCode: code,
    });
    expect(db.organizationMember.create).not.toHaveBeenCalled();
  });
  it('requires a verified matching email from live account data', async () => {
    const { db, service } = harness();
    db.user.findUnique.mockResolvedValueOnce({
      id: 'invitee',
      email: 'invitee@example.invalid',
      emailVerified: false,
      intelSuspendedAt: null,
    });
    await expect(service.acceptInvitation('invitee', token)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Verify'),
    });
    db.user.findUnique.mockResolvedValueOnce({
      id: 'invitee',
      email: 'different@example.invalid',
      emailVerified: true,
      intelSuspendedAt: null,
    });
    await expect(service.acceptInvitation('invitee', token)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('Sign in'),
    });
    expect(db.organizationMember.create).not.toHaveBeenCalled();
  });
  it('revokes effective authority when the inviter was removed, demoted, or suspended', async () => {
    const { db, service } = harness();
    db.organizationMember.findFirst.mockResolvedValue(null);
    await expect(service.acceptInvitation('invitee', token)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('inviter'),
    });
    expect(await service.invitation(token)).toMatchObject({ invitation: { status: 'revoked' } });
    expect(db.organizationMember.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        userId: 'actor',
        role: { in: ['owner', 'admin'] },
        user: { intelSuspendedAt: null },
      },
      select: { id: true },
    });
    expect(db.organizationMember.create).not.toHaveBeenCalled();
  });
  it('consumes a token with CAS before creating the correctly scoped membership', async () => {
    const { db, service } = harness();
    const result = await service.acceptInvitation('invitee', token);
    expect(result.organization).toMatchObject({ id: 'org-1', role: 'member' });
    expect(db.organizationInvitation.updateMany).toHaveBeenCalledWith({
      where: { id: 'invite-1', revision: 2, status: 'pending', expiresAt: { gt: now } },
      data: {
        status: 'accepted',
        acceptedById: 'invitee',
        acceptedAt: now,
        revision: { increment: 1 },
      },
    });
    expect(db.organizationMember.create).toHaveBeenCalledWith({
      data: { organizationId: 'org-1', userId: 'invitee', role: 'member' },
    });
    db.organizationInvitation.updateMany.mockResolvedValue({ count: 0 });
    db.organizationMember.create.mockClear();
    await expect(service.acceptInvitation('invitee', token)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.organizationMember.create).not.toHaveBeenCalled();
  });
  it('scopes invitation revocation to the organization and revision', async () => {
    const { db, service } = harness();
    db.organizationInvitation.findFirst.mockResolvedValue(null);
    await expect(
      service.revokeInvitation('actor', 'org-2', 'invite-1', input),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.organizationInvitation.findFirst).toHaveBeenCalledWith({
      where: { id: 'invite-1', organizationId: 'org-2' },
    });
    expect(db.organizationInvitation.updateMany).not.toHaveBeenCalled();
  });
});
