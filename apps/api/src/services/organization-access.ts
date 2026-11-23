import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@wisesama/database';

export type OrganizationDb = PrismaClient | Prisma.TransactionClient;
export type OrganizationRole = 'owner' | 'admin' | 'member';
export type ProjectAction = 'read' | 'contribute' | 'manage';

export class OrganizationError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'OrganizationError';
  }
}

const rolesFor = (action: ProjectAction) =>
  action === 'manage' ? ['owner', 'admin'] : ['owner', 'admin', 'member'];

/** A live database predicate: a removed or suspended member immediately loses access. */
export function organizationScope(
  userId: string,
  action: ProjectAction = 'read',
  organizationId?: string,
): Prisma.OrganizationWhereInput {
  return {
    ...(organizationId ? { id: organizationId } : {}),
    members: {
      some: { userId, role: { in: rolesFor(action) }, user: { intelSuspendedAt: null } },
    },
  };
}

export function projectScope(
  userId: string,
  action: ProjectAction = 'read',
  organizationId?: string,
): Prisma.SecurityProjectWhereInput {
  return { organization: organizationScope(userId, action, organizationId) };
}

export async function requireOrganizationAccess(
  db: OrganizationDb,
  userId: string,
  organizationId: string,
  action: ProjectAction = 'read',
) {
  const membership = await db.organizationMember.findFirst({
    where: { organizationId, userId, user: { intelSuspendedAt: null } },
    include: { organization: true },
  });
  if (!membership || !rolesFor('read').includes(membership.role))
    throw new OrganizationError(404, 'Organization not found.');
  if (!rolesFor(action).includes(membership.role))
    throw new OrganizationError(403, 'An organization owner or admin must make this change.');
  return {
    organization: membership.organization,
    role: membership.role as OrganizationRole,
    membershipId: membership.id,
    membershipRevision: membership.revision,
  };
}

export async function requireProjectAccess(
  db: OrganizationDb,
  userId: string,
  projectId: string,
  action: ProjectAction = 'read',
) {
  const project = await db.securityProject.findFirst({
    where: { id: projectId, ...projectScope(userId, 'read') },
  });
  if (!project) throw new OrganizationError(404, 'Project not found.');
  if (action === 'manage')
    await requireOrganizationAccess(db, userId, project.organizationId, action);
  return project;
}

export async function isActiveOrganizationMember(
  db: OrganizationDb,
  userId: string,
  organizationId: string,
) {
  return Boolean(
    await db.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        role: { in: rolesFor('read') },
        user: { intelSuspendedAt: null },
      },
      select: { id: true },
    }),
  );
}

export const organizationDtoSelect = {
  id: true,
  name: true,
  personalForUserId: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: true, projects: true } },
} as const satisfies Prisma.OrganizationSelect;
type OrganizationWithCounts = Prisma.OrganizationGetPayload<{
  select: typeof organizationDtoSelect;
}>;
export function organizationDto(organization: OrganizationWithCounts, role: OrganizationRole) {
  return {
    id: organization.id,
    name: organization.name,
    personal: Boolean(organization.personalForUserId),
    role,
    revision: organization.revision,
    memberCount: organization._count.members,
    projectCount: organization._count.projects,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

/** Idempotent for concurrent first visits. The deterministic ID also matches SQL backfill. */
async function ensurePersonalOrganizationOnce(db: OrganizationDb, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, intelSuspendedAt: true },
  });
  if (!user || user.intelSuspendedAt)
    throw new OrganizationError(403, 'This account cannot access Wisesama.');
  const digest = createHash('md5').update(userId).digest('hex');
  const organization = await db.organization.upsert({
    where: { personalForUserId: userId },
    update: {},
    create: {
      id: `personal-${digest}`,
      name: `${user.name?.trim() || user.email.split('@')[0] || 'Personal'}'s workspace`.slice(
        0,
        80,
      ),
      personalForUserId: userId,
      createdById: userId,
      members: { create: { id: `member-${digest}`, userId, role: 'owner' } },
    },
    select: organizationDtoSelect,
  });
  // Existing personal organizations are never silently rejoined after removal.
  const access = await requireOrganizationAccess(db, userId, organization.id);
  return organizationDto(organization, access.role);
}

export async function ensurePersonalOrganization(db: OrganizationDb, userId: string) {
  if (!('$transaction' in db)) return ensurePersonalOrganizationOnce(db, userId);
  // Nested organization+owner creation is atomic. Concurrent first visits converge
  // on the unique personalForUserId after the losing transaction rolls back.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction((tx) => ensurePersonalOrganizationOnce(tx, userId), {
        isolationLevel: 'Serializable',
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'P2002' || error.code === 'P2034') &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new OrganizationError(409, 'The workspace changed. Try again.');
}
