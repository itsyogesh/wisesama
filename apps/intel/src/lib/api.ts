import type {
  BriefingFilters,
  Briefings,
  Delivery,
  Finding,
  FindingUpdate,
  IntelAdvisory,
  InventoryInput,
  InventoryResult,
  NotificationSettings,
  ProjectInput,
  Runtime,
  ScanResult,
  Workspace,
} from './models';

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(
  /\/$/,
  '',
);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(payload: unknown, status: number) {
  if (status >= 500) return 'Wisesama couldn’t complete this request. Try again in a moment.';
  if (isRecord(payload)) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : isRecord(payload.error) && typeof payload.error.message === 'string'
          ? payload.error.message
          : typeof payload.message === 'string'
            ? payload.message
            : null;
    if (message) {
      return message;
    }
  }
  if (status === 401) return 'Your session has ended. Sign in again to continue.';
  if (status === 403) return 'This account cannot complete that action.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  return 'Wisesama could not complete this request. Please try again.';
}

export async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers:
        options.body === undefined
          ? { Accept: 'application/json' }
          : {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach Wisesama. Check your connection and try again.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      [401, 403, 404].includes(response.status) &&
      typeof window !== 'undefined' &&
      /^\/intel\/(?:projects\/|findings\/|repositories\/sources|organizations\/)/.test(path)
    ) {
      window.dispatchEvent(new Event('wisesama:membership-access-denied'));
    }
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }
  if (payload === null)
    throw new ApiError('Wisesama returned an unreadable response. Try again.', response.status);
  return (
    isRecord(payload) && 'data' in payload && 'meta' in payload ? payload.data : payload
  ) as T;
}

export const intelApi = {
  feedUrl: `${API_BASE}/api/v1/intel/feed.xml`,
  getWorkspace: (signal?: AbortSignal, organizationId?: string) =>
    request<Workspace>(
      `/intel/workspace${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
      { signal },
    ),
  createProject: (input: ProjectInput) =>
    request<InventoryResult>('/intel/projects', { method: 'POST', body: input }),
  updateInventory: (id: string, input: { inventory: InventoryInput; runtime?: Runtime }) =>
    request<InventoryResult>(`/intel/projects/${encodeURIComponent(id)}/inventory`, {
      method: 'POST',
      body: input,
    }),
  scanProject: (id: string) =>
    request<ScanResult>(`/intel/projects/${encodeURIComponent(id)}/scan`, {
      method: 'POST',
      body: {},
    }),
  updateFinding: (id: string, input: FindingUpdate) =>
    request<Finding>(`/intel/findings/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
  getBriefings: (filters: BriefingFilters = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.exploited !== undefined) params.set('exploited', String(filters.exploited));
    const query = params.toString();
    return request<Briefings>(`/intel/briefings${query ? `?${query}` : ''}`, { signal });
  },
  getBriefing: (id: string, signal?: AbortSignal) =>
    request<IntelAdvisory>(`/intel/briefings/${encodeURIComponent(id)}`, { signal }),
  getNotifications: (signal?: AbortSignal) =>
    request<NotificationSettings>('/intel/notifications', { signal }),
  updateNotifications: (emailEnabled: boolean) =>
    request<NotificationSettings>('/intel/notifications', {
      method: 'PATCH',
      body: { emailEnabled },
    }),
  testNotification: () =>
    request<Delivery>('/intel/notifications/test', { method: 'POST', body: {} }),
  getDeliveries: async (signal?: AbortSignal) =>
    (await request<{ deliveries: Delivery[] }>('/intel/deliveries', { signal })).deliveries,
};
