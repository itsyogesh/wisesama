import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

export interface ApiKey {
  id: string;
  keyPrefix: string;
  name?: string;
  remainingQuota: number;
  rateLimitPerMin: number;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreateApiKeyResponse extends ApiKey {
  key: string;
}

async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await fetch(`${API_URL}/api/v1/api-keys`, {
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch API keys');
  }

  const json = await res.json();
  return json.data?.keys || json.keys || [];
}

async function createApiKey(name?: string): Promise<CreateApiKeyResponse> {
  const res = await fetch(`${API_URL}/api/v1/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || error.error || 'Failed to create API key');
  }

  const json = await res.json();
  return json.data || json;
}

async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/api-keys/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed to revoke API key');
  }
}

export function useApiKeys() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['api-keys'],
    queryFn: fetchApiKeys,
    enabled: !!session?.user,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name?: string) => createApiKey(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
