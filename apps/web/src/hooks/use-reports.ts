import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export interface Report {
  id: string;
  reportedValue: string;
  entityType: string;
  threatCategory: string;
  description?: string;
  status: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ReportsResponse {
  reports: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SubmitReportData {
  value: string;
  entityType: 'ADDRESS' | 'DOMAIN' | 'TWITTER' | 'EMAIL';
  threatCategory: string;
  description?: string;
  reporterName?: string;
  reporterEmail?: string;
}

async function fetchRecentReports(limit = 10): Promise<{ reports: Report[] }> {
  const res = await fetch(`${API_URL}/api/v1/reports/recent?limit=${limit}`);
  if (!res.ok) {
    throw new Error('Failed to fetch recent reports');
  }
  const json = await res.json();
  return json.data || json;
}

async function fetchVerifiedReports(page = 1, limit = 20): Promise<ReportsResponse> {
  const res = await fetch(`${API_URL}/api/v1/reports?page=${page}&limit=${limit}`);
  if (!res.ok) {
    throw new Error('Failed to fetch reports');
  }
  const json = await res.json();
  return json.data || json;
}

async function fetchMyReports(token: string, page = 1, limit = 20): Promise<ReportsResponse> {
  const res = await fetch(`${API_URL}/api/v1/reports/my?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch your reports');
  }
  const json = await res.json();
  return json.data || json;
}

async function submitReport(data: SubmitReportData): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_URL}/api/v1/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to submit report');
  }
  const json = await res.json();
  return json.data || json;
}

export function useRecentReports(limit = 10) {
  return useQuery({
    queryKey: ['recent-reports', limit],
    queryFn: () => fetchRecentReports(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useVerifiedReports(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['verified-reports', page, limit],
    queryFn: () => fetchVerifiedReports(page, limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useMyReports(token: string | null, page = 1, limit = 20) {
  return useQuery({
    queryKey: ['my-reports', page, limit],
    queryFn: () => fetchMyReports(token!, page, limit),
    enabled: !!token,
    staleTime: 1 * 60 * 1000,
  });
}

export function useSubmitReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitReport,
    onSuccess: () => {
      // Invalidate reports queries to refetch
      queryClient.invalidateQueries({ queryKey: ['recent-reports'] });
      queryClient.invalidateQueries({ queryKey: ['verified-reports'] });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
    },
  });
}

// Flagged entities from blacklist (polkadot-js phishing list)
export interface FlaggedEntity {
  id: string;
  value: string;
  entityType: string;
  riskLevel: string;
  threatCategory: string | null;
  createdAt: string;
}

async function fetchRecentFlaggedEntities(limit = 5): Promise<{ entities: FlaggedEntity[] }> {
  const res = await fetch(`${API_URL}/api/v1/stats/recent-flagged?limit=${limit}`);
  if (!res.ok) {
    throw new Error('Failed to fetch recent flagged entities');
  }
  const json = await res.json();
  return json.data || json;
}

export function useRecentFlaggedEntities(limit = 5) {
  return useQuery({
    queryKey: ['recent-flagged-entities', limit],
    queryFn: () => fetchRecentFlaggedEntities(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
