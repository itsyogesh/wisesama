import { request } from './api';

export type RemediationFields = {
  pullRequestUrl: string;
  fixedCommit: string;
  testResult: 'not_run' | 'passed' | 'failed';
  testEvidence: string;
  deployedCommit: string;
  deploymentUrl: string;
  deploymentNote: string;
};
export type RemediationReport = {
  schemaVersion: number;
  findingId: string;
  revision: number;
  project: { id: string; name: string; environment: string };
  advisory: {
    id: string;
    packageName: string;
    installedVersion: string;
    fixedVersion: string | null;
  };
  repository: {
    name: string;
    url: string;
    branch: string;
    commit: string | null;
    paths: string[];
    lastSyncedAt: string | null;
  } | null;
  fields: RemediationFields;
  recheck: {
    checkedAt: string;
    commit: string | null;
    result: string;
    warnings: string[];
    sources: { name: string; status: string; checkedAt: string }[];
  } | null;
  verification: {
    inventory: 'not_checked' | 'stale' | 'clear' | 'affected' | 'incomplete';
    fixedCommitAssessed: boolean;
    tests: { result: string; provenance: string };
    deployment: { recorded: boolean; matchesAssessedFix: boolean; provenance: string };
  };
  response: { status: string; resolvedAt: string | null; evidence: string };
  history: { id: string; at: string; actorId: string; action: string }[];
  exportedAt: string;
};
const base = (id: string) => `/intel/findings/${encodeURIComponent(id)}/remediation`;
export const remediationApi = {
  get: (id: string, signal?: AbortSignal) => request<RemediationReport>(base(id), { signal }),
  save: (id: string, revision: number, fields: RemediationFields) =>
    request<RemediationReport>(base(id), { method: 'PATCH', body: { revision, fields } }),
  recheck: (id: string, revision: number) =>
    request<RemediationReport>(`${base(id)}/recheck`, { method: 'POST', body: { revision } }),
  handoff: (id: string) =>
    request<{ prompt: string; context: unknown }>(`${base(id)}/handoff`, {
      method: 'POST',
      body: {},
    }),
  evidence: (id: string) => request<RemediationReport>(`${base(id)}/evidence`),
};
