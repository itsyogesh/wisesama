import { ApiError, request } from './api';
import type { IntelAdvisory } from './models';

export interface AdminAudit {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  metadata: unknown;
  createdAt: string;
}
export interface AdminSession {
  user: { id: string; email: string; name: string | null };
  access: 'intel_admin';
}
export interface AdminPage<T> {
  items: T[];
  nextCursor: string | null;
}
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  intelAdmin: boolean;
  status: 'active' | 'suspended';
  suspendedAt: string | null;
  suspensionReason: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  projectCount: number;
  connectionCount: number;
}
export interface AdminDelivery {
  id: string;
  subject: string;
  status: string;
  error: string | null;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}
export interface AdminUserDetail {
  user: AdminUser;
  projects: Array<{
    id: string;
    name: string;
    environment: string;
    lastScannedAt: string | null;
    scanError: string | null;
  }>;
  deliveries: AdminDelivery[];
  audit: AdminAudit[];
}
export interface AdminAdvisory {
  id: string;
  aliases: string[];
  data: IntelAdvisory;
  fetchedAt: string;
  review: {
    visibility: 'published' | 'hidden';
    guidance: string;
    note: string;
    revision: number;
    reviewedAt: string | null;
  };
}
export interface AdminAdvisoryDetail {
  advisory: AdminAdvisory;
  audit: AdminAudit[];
}
export interface AdminSubscriber {
  id: string;
  email: string;
  status: 'pending' | 'active' | 'unsubscribed' | 'suppressed';
  topics: string[];
  confirmedAt: string | null;
  nextDigestAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface AdminSubscriberDetail {
  subscriber: AdminSubscriber;
  deliveries: AdminDelivery[];
  feedback: Array<{
    id: string;
    type: string;
    status: string;
    attempts: number;
    processedAt: string | null;
    lastError: string | null;
  }>;
  audit: AdminAudit[];
}
export interface AdminOverview {
  users: { total: number; suspended: number };
  advisories: { total: number; hidden: number };
  subscriptions: { active: number; pending: number; suppressed: number; unsubscribed: number };
  recentAudit: AdminAudit[];
}
export type AdminSourceId = 'osv' | 'github' | 'kev' | 'epss';
export interface AdminSource {
  id: AdminSourceId;
  name: string;
  purpose: string;
  url: string;
  paused: boolean;
  revision: number;
  health: 'unknown' | 'healthy' | 'unavailable' | 'paused';
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}
export type AdminJobKind =
  | 'source_refresh'
  | 'feed_refresh'
  | 'repository_sync'
  | 'project_assessment'
  | 'private_delivery'
  | 'public_delivery'
  | 'feedback_reconcile';
export interface AdminJob {
  id: string;
  kind: AdminJobKind;
  targetId: string | null;
  reason: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
  attempts: number;
  error: string | null;
  actorId: string | null;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  retryable: boolean;
}
export interface AdminJobDetail {
  job: AdminJob;
  attempts: Array<{
    attempt: number;
    status: string;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
}
export interface AdminFailure {
  id: string;
  kind: AdminJobKind;
  targetId: string;
  label: string;
  ownerLabel?: string;
  error: string;
  failedAt: string;
  retryable: boolean;
  blockedReason?: string;
}

export const adminPath = (path: string) => `/intel/admin${path}`;
export const ADMIN_ACCESS_LOST_EVENT = 'wisesama-admin-access-lost';
async function adminRequest<T>(...args: Parameters<typeof request>) {
  try {
    return await request<T>(...args);
  } catch (cause) {
    if (
      typeof window !== 'undefined' &&
      cause instanceof ApiError &&
      [401, 403].includes(cause.status)
    )
      window.dispatchEvent(new Event(ADMIN_ACCESS_LOST_EVENT));
    throw cause;
  }
}
export const adminApi = {
  get: <T>(path: string, signal?: AbortSignal) => adminRequest<T>(adminPath(path), { signal }),
  session: (signal?: AbortSignal) => adminRequest<AdminSession>(adminPath('/session'), { signal }),
  access: (id: string, input: { suspended: boolean; expectedRevision: number; reason: string }) =>
    adminRequest<AdminUserDetail>(adminPath(`/users/${encodeURIComponent(id)}/access`), {
      method: 'PATCH',
      body: input,
    }),
  review: (
    id: string,
    input: {
      expectedRevision: number;
      visibility: 'published' | 'hidden';
      guidance: string;
      note: string;
      reason: string;
    },
  ) =>
    adminRequest<AdminAdvisoryDetail>(adminPath(`/advisories/${encodeURIComponent(id)}/review`), {
      method: 'PATCH',
      body: input,
    }),
  subscription: (
    id: string,
    input: { status: 'unsubscribed' | 'suppressed'; expectedRevision: number; reason: string },
  ) =>
    adminRequest<AdminSubscriberDetail>(
      adminPath(`/subscriptions/${encodeURIComponent(id)}/status`),
      {
        method: 'PATCH',
        body: input,
      },
    ),
  source: (id: string, input: { paused: boolean; expectedRevision: number; reason: string }) =>
    adminRequest<{ source: AdminSource }>(adminPath(`/sources/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      body: input,
    }),
  queue: (input: { kind: AdminJobKind; targetId?: string; reason: string }) =>
    adminRequest<{ job: AdminJob; deduplicated: boolean }>(adminPath('/jobs'), {
      method: 'POST',
      body: input,
    }),
  run: (id: string) =>
    adminRequest<{ job: AdminJob }>(adminPath(`/jobs/${encodeURIComponent(id)}/run`), {
      method: 'POST',
      body: {},
    }),
  retry: (id: string, input: { reason: string; expectedUpdatedAt: string }) =>
    adminRequest<{ job: AdminJob }>(adminPath(`/jobs/${encodeURIComponent(id)}/retry`), {
      method: 'POST',
      body: input,
    }),
};
