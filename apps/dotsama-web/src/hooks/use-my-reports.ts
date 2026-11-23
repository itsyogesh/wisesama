import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export interface Report {
  id: string;
  reportedValue: string;
  entityType: string;
  threatCategory: string;
  description?: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
}

interface MyReportsResponse {
  reports: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function fetchMyReports(page = 1): Promise<MyReportsResponse> {
  const res = await fetch(`${API_URL}/api/v1/reports/me?page=${page}&limit=20`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch reports');
  }

  const json = await res.json();
  return json.data || json;
}

export function useMyReports(page = 1) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['my-reports', page],
    queryFn: () => fetchMyReports(page),
    enabled: !!session?.user,
  });
}
