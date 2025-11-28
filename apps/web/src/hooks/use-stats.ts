import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export interface PlatformStats {
  totalReports: number;
  verifiedReports: number;
  totalUsers: number;
  totalSearches: number;
  totalEntities: number;
  flaggedAddresses: number;
}

async function fetchStats(): Promise<PlatformStats> {
  const res = await fetch(`${API_URL}/api/v1/stats`);
  if (!res.ok) {
    throw new Error('Failed to fetch stats');
  }
  const json = await res.json();
  return json.data || json;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: fetchStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
