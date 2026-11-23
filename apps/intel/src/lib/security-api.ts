import { request } from './api';
import type { Environment } from './models';

export type ContextAnswer = 'yes' | 'no' | 'unknown';
export interface ProjectContextInput {
  internetFacing: ContextAnswer;
  sensitiveData: ContextAnswer;
  hosting: string;
}
export interface ProjectContext extends ProjectContextInput {
  updatedAt: string | null;
  provenance: 'self_reported';
}
export interface BaselineCheck {
  id: 'package_manager' | 'lockfile' | 'ci_install' | 'dependency_cooldown' | 'ci_dependencies';
  title: string;
  state: 'observed' | 'attention' | 'unknown';
  summary: string;
  evidence: Array<{ path: string; detail: string }>;
  recommendation: string;
  documentationUrl: string;
}
export interface CiDependency {
  id: string;
  path: string;
  line: number;
  kind: 'action' | 'reusable_workflow' | 'container' | 'gitlab_include' | 'local_action';
  name: string;
  reference: string | null;
  state: 'pinned' | 'locked' | 'mutable' | 'local' | 'unknown';
  detail: string;
  recommendation: string;
}
export interface CiDependencyReport {
  version: 1;
  state: 'observed' | 'attention' | 'unknown';
  items: CiDependency[];
  filesChecked: string[];
  issues: Array<{ path: string; line: number | null; detail: string }>;
  incomplete: boolean;
  limitations: string[];
}
export interface ProjectSecurity {
  project: { id: string; name: string; environment: Environment };
  context: ProjectContext;
  repository: {
    provider: 'github' | 'gitlab';
    repositoryName: string;
    branch: string;
    importedCommit: string | null;
    observedCommit: string | null;
    status: string;
    paused: boolean;
    paths: string[];
  } | null;
  baseline: {
    status: 'unsupported' | 'not_checked' | 'current' | 'stale' | 'unavailable';
    commit: string | null;
    inventoryPaths: string[];
    checkedAt: string | null;
    attemptedAt: string | null;
    error: string | null;
    checks: BaselineCheck[];
    /** Older saved snapshots require a recheck to collect CI dependency evidence. */
    ciDependencies?: CiDependencyReport | null;
    scope: 'repository_configuration';
    limitations: string[];
  };
}

const path = (id: string) => `/intel/projects/${encodeURIComponent(id)}`;
export const securityApi = {
  get: (id: string, signal?: AbortSignal) =>
    request<ProjectSecurity>(`${path(id)}/security`, { signal }),
  saveContext: (id: string, context: ProjectContextInput) =>
    request<ProjectSecurity>(`${path(id)}/context`, { method: 'PATCH', body: context }),
  check: (id: string) =>
    request<ProjectSecurity>(`${path(id)}/baseline`, { method: 'POST', body: {} }),
};
