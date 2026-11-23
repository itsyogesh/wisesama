import { request } from './api';

export type PlaybookAnswer = 'yes' | 'no' | 'unknown';
export type PlaybookStatus =
  | 'investigating'
  | 'contained'
  | 'recovering'
  | 'closed'
  | 'not_affected';
export interface Playbook {
  id: string;
  version: string;
  title: string;
  description: string;
  updatedAt: string;
  scope: string;
  questions: Array<{ id: string; label: string; help: string }>;
  phases: Array<{
    id: string;
    title: string;
    description: string;
    tasks: Array<{ id: string; title: string; detail: string; evidenceHint: string }>;
  }>;
  sources: Array<{ title: string; url: string }>;
  limitations: string[];
}
export interface PlaybookEvent {
  id: string;
  status: PlaybookStatus;
  note: string;
  evidence: string;
  answers: Record<string, PlaybookAnswer>;
  checks: Record<string, boolean>;
  createdAt: string;
}
export interface SavedResponse {
  id: string;
  projectId: string;
  playbookId: string;
  templateVersion: string;
  status: PlaybookStatus;
  answers: Record<string, PlaybookAnswer>;
  checks: Record<string, boolean>;
  note: string;
  evidence: string;
  revision: number;
  verificationState: 'user_attested';
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  events: PlaybookEvent[];
}
export interface ResponseInput {
  expectedRevision: number;
  status: PlaybookStatus;
  answers: Record<string, PlaybookAnswer>;
  checks: Record<string, boolean>;
  note: string;
  evidence: string;
}
const path = (projectId: string, id: string) =>
  `/intel/projects/${encodeURIComponent(projectId)}/responses/${encodeURIComponent(id)}`;
export const playbookApi = {
  list: (signal?: AbortSignal) =>
    request<{ playbooks: Playbook[] }>('/intel/playbooks', { signal }),
  template: (id: string, signal?: AbortSignal) =>
    request<{ playbook: Playbook }>(`/intel/playbooks/${encodeURIComponent(id)}`, { signal }),
  responses: (projectId: string, signal?: AbortSignal) =>
    request<{ responses: SavedResponse[] }>(
      `/intel/projects/${encodeURIComponent(projectId)}/responses`,
      { signal },
    ),
  get: (projectId: string, id: string, signal?: AbortSignal) =>
    request<{ playbook: Playbook; response: SavedResponse | null }>(path(projectId, id), {
      signal,
    }),
  start: (projectId: string, id: string) =>
    request<{ response: SavedResponse }>(path(projectId, id), { method: 'POST', body: {} }),
  update: (projectId: string, id: string, input: ResponseInput) =>
    request<{ response: SavedResponse }>(path(projectId, id), { method: 'PATCH', body: input }),
};
