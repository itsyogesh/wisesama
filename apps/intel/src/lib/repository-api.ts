import { request } from './api';
import type { Environment, InventoryPackage } from './models';
export type Provider = 'github' | 'gitlab';
export interface ProviderState {
  provider: Provider;
  available: boolean;
  reason: string | null;
  permissions: string;
  method: string;
}
export interface Connection {
  id: string;
  provider: Provider;
  accountName: string;
  status: string;
  installationId: string | null;
  installationAccountName?: string | null;
  repositorySelection?: 'all' | 'selected' | null;
  validatedAt: string | null;
  error: string | null;
  createdAt: string;
}
export interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  url: string;
}
export interface RepositoryPage {
  repositories: Repository[];
  incomplete: boolean;
  nextPage?: number;
  installationAccountName?: string | null;
  repositorySelection?: Connection['repositorySelection'];
}
export interface RepositorySource {
  id: string;
  projectId: string;
  connectionId: string;
  connectorUserId: string;
  provider: Provider;
  repositoryId: string;
  repositoryName: string;
  repositoryUrl: string;
  branch: string;
  paths: string[];
  scope: string;
  paused: boolean;
  status: string;
  importedCommit: string | null;
  observedCommit: string | null;
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
  lastAssessedAt?: string | null;
  assessmentError?: string | null;
  error: string | null;
  importedFiles: Array<{ path: string; digest: string }>;
}
export interface Snapshot {
  repository: Repository;
  commit: string;
  scope: 'repository_inventory';
  packages: InventoryPackage[];
  warnings: string[];
  files: Array<{ path: string; digest: string }>;
  digest: string;
}
const base = '/intel/repositories';
export const repositoryApi = {
  connections: () =>
    request<{ providers: ProviderState[]; connections: Connection[] }>(`${base}/connections`),
  start: (provider: Provider, destination?: 'project') =>
    request<{ authorizationUrl: string }>(`${base}/${provider}/start`, {
      method: 'POST',
      body: destination ? { destination } : {},
    }),
  repositories: (id: string, page: number, signal?: AbortSignal) =>
    request<RepositoryPage>(
      `${base}/connections/${encodeURIComponent(id)}/repositories?page=${page}`,
      { signal },
    ),
  branches: (id: string, repositoryId: string) =>
    request<{ branches: Array<{ name: string }>; incomplete: boolean }>(
      `${base}/connections/${encodeURIComponent(id)}/branches?repositoryId=${encodeURIComponent(repositoryId)}`,
    ),
  discover: (id: string, repositoryId: string, branch: string) =>
    request<{
      repository: Repository;
      commit: string;
      paths: Array<{ path: string; format: string; size: number | null }>;
      incomplete: boolean;
      warnings: string[];
    }>(
      `${base}/connections/${encodeURIComponent(id)}/discovery?repositoryId=${encodeURIComponent(repositoryId)}&branch=${encodeURIComponent(branch)}`,
    ),
  preview: (id: string, input: { repositoryId: string; branch: string; paths: string[] }) =>
    request<Snapshot>(`${base}/connections/${encodeURIComponent(id)}/preview`, {
      method: 'POST',
      body: input,
    }),
  create: (input: {
    organizationId: string;
    connectionId: string;
    expectedCommit?: string;
    repositoryId: string;
    branch: string;
    paths: string[];
    name: string;
    environment: Environment;
  }) =>
    request<{ project: { id: string }; source: RepositorySource }>(`${base}/projects`, {
      method: 'POST',
      body: input,
    }),
  sources: (organizationId?: string, signal?: AbortSignal) =>
    request<{ sources: RepositorySource[] }>(
      `${base}/sources${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
      { signal },
    ),
  sync: (id: string) =>
    request(`${base}/sources/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} }),
  update: (id: string, input: { paused?: boolean; branch?: string; paths?: string[] }) =>
    request(`${base}/sources/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  detach: (id: string) =>
    request(`${base}/sources/${encodeURIComponent(id)}`, { method: 'DELETE', body: {} }),
  disconnect: (id: string) =>
    request(`${base}/connections/${encodeURIComponent(id)}`, { method: 'DELETE', body: {} }),
};
