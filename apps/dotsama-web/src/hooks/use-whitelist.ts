import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export interface WhitelistedEntity {
  id: string;
  name: string;
  category: string;
  entityType: string;
  value: string;
  description?: string;
  website?: string;
  twitter?: string;
  logoUrl?: string;
  verifiedAt: string;
  chain?: {
    name: string;
    code: string;
  };
}

interface WhitelistResponse {
  entities: WhitelistedEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface WhitelistParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

async function fetchWhitelist(params: WhitelistParams): Promise<WhitelistResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);

  const res = await fetch(`${API_URL}/api/v1/whitelist?${query.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch whitelist');
  }
  const json = await res.json();
  return json.data || json;
}

export function useWhitelist(params: WhitelistParams) {
  return useQuery({
    queryKey: ['whitelist', params],
    queryFn: () => fetchWhitelist(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
