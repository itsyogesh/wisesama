import { request } from './api';

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string;
  name: string;
  personal: boolean;
  role: OrganizationRole;
  revision: number;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: OrganizationRole;
  revision: number;
  joinedAt: string;
  suspended: boolean;
}

export interface OrganizationInvitationRecord {
  id: string;
  email: string;
  role: 'admin' | 'member';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  revision: number;
}

export interface OrganizationDetail {
  organization: Organization;
  members: OrganizationMember[];
  invitations: OrganizationInvitationRecord[];
  audit: Array<{
    id: string;
    action: string;
    reason?: string | null;
    actorName?: string | null;
    createdAt: string;
  }>;
  canManage: boolean;
  currentMembershipId: string;
}

export interface InvitationPreview {
  invitation: {
    organizationName: string;
    role: 'admin' | 'member';
    expiresAt: string;
    status: 'pending' | 'expired' | 'revoked' | 'accepted';
  };
}

const base = '/intel/organizations';
const item = (id: string) => `${base}/${encodeURIComponent(id)}`;

export const organizationApi = {
  list: (signal?: AbortSignal) =>
    request<{ organizations: Organization[]; defaultOrganizationId: string | null }>(base, {
      signal,
    }),
  create: (name: string) =>
    request<{ organization: Organization }>(base, { method: 'POST', body: { name } }),
  detail: (id: string, signal?: AbortSignal) => request<OrganizationDetail>(item(id), { signal }),
  rename: (id: string, name: string, expectedRevision: number) =>
    request<{ organization: Organization }>(item(id), {
      method: 'PATCH',
      body: { name, expectedRevision },
    }),
  invite: (id: string, email: string, role: 'admin' | 'member') =>
    request<{
      invitation: OrganizationInvitationRecord;
      inviteUrl: string;
      delivery: 'share_link';
    }>(`${item(id)}/invitations`, {
      method: 'POST',
      body: { email, role },
    }),
  revoke: (id: string, invitationId: string, expectedRevision: number, reason: string) =>
    request(`${item(id)}/invitations/${encodeURIComponent(invitationId)}/revoke`, {
      method: 'POST',
      body: { expectedRevision, reason },
    }),
  setRole: (
    id: string,
    memberId: string,
    role: OrganizationRole,
    expectedRevision: number,
    reason: string,
  ) =>
    request(`${item(id)}/members/${encodeURIComponent(memberId)}`, {
      method: 'PATCH',
      body: { role, expectedRevision, reason },
    }),
  remove: (id: string, memberId: string, expectedRevision: number, reason: string) =>
    request(`${item(id)}/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      body: { expectedRevision, reason },
    }),
  previewInvitation: (token: string, signal?: AbortSignal) =>
    request<InvitationPreview>(`/intel/organization-invitations/${encodeURIComponent(token)}`, {
      signal,
    }),
  acceptInvitation: (token: string) =>
    request<{ organization: Organization }>(
      `/intel/organization-invitations/${encodeURIComponent(token)}/accept`,
      {
        method: 'POST',
        body: {},
      },
    ),
};

export function canManageOrganization(role?: OrganizationRole) {
  return role === 'owner' || role === 'admin';
}

export const organizationSelectionKey = (userId: string) => `wisesama:organization:${userId}`;
