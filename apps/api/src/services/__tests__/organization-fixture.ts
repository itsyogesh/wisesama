import { type Mock, vi } from 'vitest';
import type { OrganizationRole } from '../organization-access';

type FixtureProject = { id: string; userId?: string; organizationId: string };
interface OrganizationFixture {
  members: Map<string, OrganizationRole>;
  suspended: Set<string>;
  organization: { id: string; name: string };
  organizationMember: { findFirst: Mock };
  projectMatches: (where: Record<string, unknown> | undefined, project: FixtureProject) => boolean;
}

/** Small relational fixture: queries must include the live membership/role predicate. */
export function organizationFixture(owner: string, organizationId = 'org-1'): OrganizationFixture {
  const members = new Map<string, OrganizationRole>([[owner, 'owner']]);
  const suspended = new Set<string>();
  const organization = { id: organizationId, name: 'Team' };
  function membershipMatches(userId: string, allowed?: { in?: string[] }) {
    const role = members.get(userId);
    return Boolean(role && !suspended.has(userId) && (!allowed?.in || allowed.in.includes(role)));
  }
  function projectMatches(
    where: Record<string, unknown> | undefined,
    project: { id: string; userId?: string; organizationId: string },
  ) {
    if (!where) return true;
    if (where.id && where.id !== project.id) return false;
    if (where.userId && where.userId !== project.userId) return false;
    const scope = where.organization as
      | {
          id?: string;
          members?: {
            some?: {
              userId: string;
              role?: { in?: string[] };
              user?: { intelSuspendedAt?: unknown };
            };
          };
        }
      | undefined;
    if (!scope) return true;
    if (scope.id && scope.id !== project.organizationId) return false;
    const member = scope.members?.some;
    return Boolean(
      member &&
        member.user?.intelSuspendedAt === null &&
        membershipMatches(member.userId, member.role),
    );
  }
  const organizationMember = {
    findFirst: vi
      .fn()
      .mockImplementation(
        async ({
          where,
        }: {
          where: { organizationId: string; userId: string; role?: { in?: string[] } };
        }) =>
          where.organizationId === organizationId && membershipMatches(where.userId, where.role)
            ? {
                id: `member-${where.userId}`,
                userId: where.userId,
                organizationId,
                role: members.get(where.userId),
                revision: 0,
                organization,
              }
            : null,
      ),
  };
  return { members, suspended, organization, organizationMember, projectMatches };
}
