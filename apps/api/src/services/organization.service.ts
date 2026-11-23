import { createHash, randomBytes } from 'node:crypto';
import { type Prisma, type PrismaClient, prisma } from '@wisesama/database';
import {
  ensurePersonalOrganization,
  OrganizationError,
  type OrganizationRole,
  organizationDto,
  organizationDtoSelect,
  organizationScope,
  requireOrganizationAccess,
} from './organization-access';

type Tx = Prisma.TransactionClient;
type RevisionInput = { expectedRevision: number; reason?: string };
const invitationSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  revision: true,
  expiresAt: true,
  createdAt: true,
} as const satisfies Prisma.OrganizationInvitationSelect;
type Invitation = Prisma.OrganizationInvitationGetPayload<{ select: typeof invitationSelect }>;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const validRole = (role: string): role is OrganizationRole =>
  ['owner', 'admin', 'member'].includes(role);

export function createOrganizationService(
  options: { db?: PrismaClient; now?: () => Date; appUrl?: string; token?: () => string } = {},
) {
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  const makeToken = options.token ?? (() => randomBytes(32).toString('base64url'));
  const invitationDto = (invitation: Invitation) => ({
    id: invitation.id,
    email: invitation.email,
    role: invitation.role as 'admin' | 'member',
    status:
      invitation.status === 'pending' && invitation.expiresAt <= now()
        ? 'expired'
        : invitation.status,
    revision: invitation.revision,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  });
  async function transaction<T>(work: (tx: Tx) => Promise<T>) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2034' || error.code === 'P2002')
          throw new OrganizationError(409, 'The organization changed. Refresh and try again.');
      }
      throw error;
    }
  }
  async function activeUser(tx: Tx | PrismaClient, userId: string) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerified: true, intelSuspendedAt: true },
    });
    if (!user || user.intelSuspendedAt)
      throw new OrganizationError(403, 'This account cannot access Wisesama.');
    return user;
  }
  async function touch(tx: Tx, organizationId: string, revision: number) {
    const changed = await tx.organization.updateMany({
      where: { id: organizationId, revision },
      data: { revision: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new OrganizationError(409, 'The organization changed. Refresh and try again.');
  }
  async function dto(tx: Tx | PrismaClient, id: string, role: OrganizationRole) {
    const organization = await tx.organization.findUnique({
      where: { id },
      select: organizationDtoSelect,
    });
    if (!organization) throw new OrganizationError(404, 'Organization not found.');
    return organizationDto(organization, role);
  }
  function shareUrl(token: string) {
    const value = options.appUrl ?? process.env.INTEL_APP_URL;
    let url: URL;
    try {
      url = new URL(
        value ?? (process.env.NODE_ENV !== 'production' ? 'http://localhost:3003' : ''),
      );
    } catch {
      throw new OrganizationError(503, 'Organization invitation links are not configured.');
    }
    if (
      url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
    )
      throw new OrganizationError(503, 'Organization invitation links are not configured.');
    url.pathname = '/invite';
    url.search = '';
    url.hash = '';
    url.searchParams.set('token', token);
    return url.toString();
  }
  async function audit(
    tx: Tx,
    organizationId: string,
    actorId: string,
    action: string,
    extra: {
      targetUserId?: string;
      targetInvitationId?: string;
      reason?: string;
      metadata?: Prisma.InputJsonValue;
    } = {},
  ) {
    await tx.organizationAudit.create({
      data: { organizationId, actorId, action, ...extra },
    });
  }
  async function currentInviter(
    tx: Tx | PrismaClient,
    invitation: { organizationId: string; createdById: string | null },
  ) {
    if (!invitation.createdById) return false;
    const inviter = await tx.organizationMember.findFirst({
      where: {
        organizationId: invitation.organizationId,
        userId: invitation.createdById,
        role: { in: ['owner', 'admin'] },
        user: { intelSuspendedAt: null },
      },
      select: { id: true },
    });
    return Boolean(inviter);
  }
  async function targetMember(tx: Tx, organizationId: string, memberId: string) {
    const member = await tx.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) throw new OrganizationError(404, 'Organization member not found.');
    return member;
  }
  function revisionMatches(actual: number, expected: number) {
    if (actual !== expected)
      throw new OrganizationError(409, 'This item changed. Refresh before making another change.');
  }
  async function memberChange(
    actorId: string,
    organizationId: string,
    memberId: string,
    input: RevisionInput,
    nextRole?: OrganizationRole,
  ) {
    return transaction(async (tx) => {
      const access = await requireOrganizationAccess(tx, actorId, organizationId, 'manage');
      const member = await targetMember(tx, organizationId, memberId);
      revisionMatches(member.revision, input.expectedRevision);
      if (member.userId === actorId)
        throw new OrganizationError(409, 'Ask another owner to change or remove your membership.');
      if (access.role !== 'owner' && (member.role === 'owner' || nextRole === 'owner'))
        throw new OrganizationError(403, 'Only an owner can change organization ownership.');
      if (nextRole && !validRole(nextRole))
        throw new OrganizationError(400, 'Choose a valid role.');
      if (member.role === 'owner' && nextRole !== 'owner') {
        const owners = await tx.organizationMember.count({
          where: {
            organizationId,
            role: 'owner',
            userId: { not: member.userId },
            user: { intelSuspendedAt: null },
          },
        });
        if (owners < 1)
          throw new OrganizationError(409, 'Keep at least one active organization owner.');
      }
      await touch(tx, organizationId, access.organization.revision);
      const changed = nextRole
        ? await tx.organizationMember.updateMany({
            where: { id: member.id, organizationId, revision: input.expectedRevision },
            data: { role: nextRole, revision: { increment: 1 } },
          })
        : await tx.organizationMember.deleteMany({
            where: { id: member.id, organizationId, revision: input.expectedRevision },
          });
      if (changed.count !== 1)
        throw new OrganizationError(409, 'This membership changed. Refresh and try again.');
      if (!nextRole) {
        // Invalidate in-flight leases as well as future scheduling. Saved inventory
        // and baseline evidence remain available to the organization.
        await tx.projectRepositorySource.updateMany({
          where: { userId: member.userId, project: { organizationId } },
          data: {
            paused: true,
            status: 'access_removed',
            error:
              'The repository connector is no longer an organization member. Connect a current member’s account to resume.',
            syncToken: null,
            syncStartedAt: null,
            baselineToken: null,
            baselineStartedAt: null,
          },
        });
      }
      await audit(
        tx,
        organizationId,
        actorId,
        nextRole ? 'member.role_changed' : 'member.removed',
        {
          targetUserId: member.userId,
          reason: input.reason,
          metadata: { previousRole: member.role, ...(nextRole ? { role: nextRole } : {}) },
        },
      );
      return { organization: await dto(tx, organizationId, access.role) };
    });
  }
  return {
    async list(userId: string) {
      let personal: Awaited<ReturnType<typeof ensurePersonalOrganization>> | null;
      try {
        personal = await ensurePersonalOrganization(db, userId);
      } catch (error) {
        if (!(error instanceof OrganizationError) || error.statusCode !== 404) throw error;
        personal = null;
      }
      const memberships = await db.organizationMember.findMany({
        where: { userId, organization: organizationScope(userId) },
        include: { organization: { select: organizationDtoSelect } },
        orderBy: { createdAt: 'asc' },
      });
      return {
        organizations: memberships.map((member) =>
          organizationDto(member.organization, member.role as OrganizationRole),
        ),
        defaultOrganizationId: personal?.id ?? memberships[0]?.organization.id ?? null,
      };
    },
    async create(userId: string, input: { name: string }) {
      return transaction(async (tx) => {
        await activeUser(tx, userId);
        const owned = await tx.organizationMember.count({ where: { userId, role: 'owner' } });
        if (owned >= 20)
          throw new OrganizationError(409, 'This account already owns 20 organizations.');
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            createdById: userId,
            members: { create: { userId, role: 'owner' } },
          },
          select: organizationDtoSelect,
        });
        await audit(tx, organization.id, userId, 'organization.created');
        return { organization: organizationDto(organization, 'owner') };
      });
    },
    async get(userId: string, organizationId: string) {
      const access = await requireOrganizationAccess(db, userId, organizationId);
      const canManage = access.role === 'owner' || access.role === 'admin';
      const [organization, members, invitations, events] = await Promise.all([
        dto(db, organizationId, access.role),
        db.organizationMember.findMany({
          where: { organizationId },
          select: {
            id: true,
            userId: true,
            role: true,
            revision: true,
            createdAt: true,
            user: { select: { name: true, email: true, intelSuspendedAt: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 500,
        }),
        canManage
          ? db.organizationInvitation.findMany({
              where: { organizationId },
              select: invitationSelect,
              orderBy: { createdAt: 'desc' },
              take: 100,
            })
          : [],
        canManage
          ? db.organizationAudit.findMany({
              where: { organizationId },
              select: {
                id: true,
                actorId: true,
                targetUserId: true,
                targetInvitationId: true,
                action: true,
                reason: true,
                metadata: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 100,
            })
          : [],
      ]);
      return {
        organization,
        canManage,
        currentMembershipId: access.membershipId,
        members: members.map((member) => ({
          id: member.id,
          userId: member.userId,
          name: member.user.name,
          email: member.user.email,
          role: member.role,
          revision: member.revision,
          joinedAt: member.createdAt.toISOString(),
          suspended: Boolean(member.user.intelSuspendedAt),
        })),
        invitations: invitations.map(invitationDto),
        audit: events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      };
    },
    async rename(
      userId: string,
      organizationId: string,
      input: { name: string; expectedRevision: number },
    ) {
      return transaction(async (tx) => {
        const access = await requireOrganizationAccess(tx, userId, organizationId, 'manage');
        if (access.role !== 'owner')
          throw new OrganizationError(403, 'Only an owner can rename this organization.');
        revisionMatches(access.organization.revision, input.expectedRevision);
        const changed = await tx.organization.updateMany({
          where: { id: organizationId, revision: input.expectedRevision },
          data: { name: input.name, revision: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new OrganizationError(409, 'The organization changed. Refresh and try again.');
        await audit(tx, organizationId, userId, 'organization.renamed');
        return { organization: await dto(tx, organizationId, access.role) };
      });
    },
    async invite(
      userId: string,
      organizationId: string,
      input: { email: string; role: 'admin' | 'member' },
    ) {
      const token = makeToken();
      const inviteUrl = shareUrl(token);
      return transaction(async (tx) => {
        const access = await requireOrganizationAccess(tx, userId, organizationId, 'manage');
        const email = input.email.trim().toLowerCase();
        const member = await tx.organizationMember.findFirst({
          where: { organizationId, user: { email: { equals: email, mode: 'insensitive' } } },
          select: { id: true },
        });
        if (member)
          throw new OrganizationError(409, 'This person is already an organization member.');
        const count = await tx.organizationMember.count({ where: { organizationId } });
        if (count >= 500)
          throw new OrganizationError(409, 'This organization has reached its member limit.');
        const previous = await tx.organizationInvitation.findUnique({
          where: { organizationId_email: { organizationId, email } },
        });
        if (previous?.status === 'pending' && previous.expiresAt > now())
          throw new OrganizationError(
            409,
            'A pending invitation already exists. Revoke it before creating a new link.',
          );
        await touch(tx, organizationId, access.organization.revision);
        const values = {
          email,
          role: input.role,
          tokenHash: tokenHash(token),
          status: 'pending',
          expiresAt: new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000),
          createdById: userId,
          acceptedById: null,
          acceptedAt: null,
        };
        const invitation = previous
          ? await tx.organizationInvitation.update({
              where: { id: previous.id },
              data: { ...values, revision: { increment: 1 }, createdAt: now() },
              select: invitationSelect,
            })
          : await tx.organizationInvitation.create({
              data: { organizationId, ...values },
              select: invitationSelect,
            });
        await audit(tx, organizationId, userId, 'invitation.created', {
          targetInvitationId: invitation.id,
          metadata: { role: input.role },
        });
        return {
          invitation: invitationDto(invitation),
          inviteUrl,
          delivery: 'share_link' as const,
        };
      });
    },
    async revokeInvitation(
      userId: string,
      organizationId: string,
      invitationId: string,
      input: RevisionInput,
    ) {
      return transaction(async (tx) => {
        const access = await requireOrganizationAccess(tx, userId, organizationId, 'manage');
        const invitation = await tx.organizationInvitation.findFirst({
          where: { id: invitationId, organizationId },
        });
        if (!invitation) throw new OrganizationError(404, 'Organization invitation not found.');
        revisionMatches(invitation.revision, input.expectedRevision);
        if (invitation.status !== 'pending')
          throw new OrganizationError(409, 'This invitation is no longer pending.');
        await touch(tx, organizationId, access.organization.revision);
        const changed = await tx.organizationInvitation.updateMany({
          where: {
            id: invitationId,
            organizationId,
            revision: input.expectedRevision,
            status: 'pending',
          },
          data: { status: 'revoked', revision: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new OrganizationError(409, 'This invitation changed. Refresh and try again.');
        await audit(tx, organizationId, userId, 'invitation.revoked', {
          targetInvitationId: invitationId,
          reason: input.reason,
        });
        return { revoked: true };
      });
    },
    changeMember(
      userId: string,
      organizationId: string,
      memberId: string,
      input: RevisionInput & { role: OrganizationRole },
    ) {
      return memberChange(userId, organizationId, memberId, input, input.role);
    },
    removeMember(userId: string, organizationId: string, memberId: string, input: RevisionInput) {
      return memberChange(userId, organizationId, memberId, input);
    },
    async invitation(token: string) {
      const invitation = await db.organizationInvitation.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { organization: { select: { name: true } } },
      });
      if (!invitation) throw new OrganizationError(404, 'Invitation not found.');
      let status = invitationDto(invitation).status;
      if (status === 'pending' && !(await currentInviter(db, invitation))) status = 'revoked';
      return {
        invitation: {
          organizationName: invitation.organization.name,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISOString(),
          status,
        },
      };
    },
    async acceptInvitation(userId: string, token: string) {
      return transaction(async (tx) => {
        const user = await activeUser(tx, userId);
        const invitation = await tx.organizationInvitation.findUnique({
          where: { tokenHash: tokenHash(token) },
        });
        if (!invitation) throw new OrganizationError(404, 'Invitation not found.');
        if (invitation.status !== 'pending')
          throw new OrganizationError(
            409,
            'This invitation is no longer pending. Ask for a new link.',
          );
        if (invitation.expiresAt <= now())
          throw new OrganizationError(409, 'This invitation expired. Ask for a new link.');
        if (!user.emailVerified)
          throw new OrganizationError(
            403,
            'Verify your account email before accepting this invitation.',
          );
        if (user.email.trim().toLowerCase() !== invitation.email)
          throw new OrganizationError(
            403,
            'Sign in with the email address this invitation was sent to.',
          );
        if (!(await currentInviter(tx, invitation)))
          throw new OrganizationError(
            409,
            'The inviter can no longer add members. Ask an organization owner for a new link.',
          );
        const organization = await tx.organization.findUnique({
          where: { id: invitation.organizationId },
        });
        if (!organization) throw new OrganizationError(404, 'Organization not found.');
        const existing = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: invitation.organizationId, userId } },
        });
        if (existing)
          throw new OrganizationError(409, 'You are already a member of this organization.');
        const count = await tx.organizationMember.count({
          where: { organizationId: invitation.organizationId },
        });
        if (count >= 500)
          throw new OrganizationError(409, 'This organization has reached its member limit.');
        await touch(tx, invitation.organizationId, organization.revision);
        const accepted = await tx.organizationInvitation.updateMany({
          where: {
            id: invitation.id,
            revision: invitation.revision,
            status: 'pending',
            expiresAt: { gt: now() },
          },
          data: {
            status: 'accepted',
            acceptedById: userId,
            acceptedAt: now(),
            revision: { increment: 1 },
          },
        });
        if (accepted.count !== 1)
          throw new OrganizationError(409, 'This invitation changed. Ask for a new link.');
        await tx.organizationMember.create({
          data: { organizationId: invitation.organizationId, userId, role: invitation.role },
        });
        await audit(tx, invitation.organizationId, userId, 'invitation.accepted', {
          targetUserId: userId,
          targetInvitationId: invitation.id,
          metadata: { role: invitation.role },
        });
        return {
          organization: await dto(
            tx,
            invitation.organizationId,
            invitation.role as OrganizationRole,
          ),
        };
      });
    },
  };
}

export const organizationService = createOrganizationService();
