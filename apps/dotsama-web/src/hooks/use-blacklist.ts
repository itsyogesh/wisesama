import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export interface BlacklistedEntity {
  id: string;
  value: string;
  entityType: string;
  riskLevel: string;
  threatCategory: string | null;
  threatName: string | null;
  createdAt: string;
}

interface BlacklistResponse {
  entities: BlacklistedEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BlacklistParams {
  page?: number;
  limit?: number;
  search?: string;
  riskLevel?: string;
}

async function fetchBlacklist(params: BlacklistParams): Promise<BlacklistResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.search) query.set('search', params.search);
  if (params.riskLevel) query.set('riskLevel', params.riskLevel);

  const res = await fetch(`${API_URL}/api/v1/blacklist?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch blacklist');
  }
  const json = await res.json();
  return json.data || json;
}

export function useBlacklist(params: BlacklistParams) {
  return useQuery({
    queryKey: ['blacklist', params],
    queryFn: () => fetchBlacklist(params),
    staleTime: 2 * 60 * 1000,
  });
}
