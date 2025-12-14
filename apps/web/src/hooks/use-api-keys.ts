import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/use-auth-store';

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
  key: string; // The full key, only returned on creation
}

async function fetchApiKeys(token: string): Promise<ApiKey[]> {
  const res = await fetch(`${API_URL}/api/v1/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch API keys');
  }

  const json = await res.json();
  return json.data?.keys || json.keys || [];
}

async function createApiKey(token: string, name?: string): Promise<CreateApiKeyResponse> {
  const res = await fetch(`${API_URL}/api/v1/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || error.error || 'Failed to create API key');
  }

  const json = await res.json();
  return json.data || json;
}

async function revokeApiKey(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/api-keys/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error('Failed to revoke API key');
  }
}

export function useApiKeys() {
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => fetchApiKeys(token!),
    enabled: !!token,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: (name?: string) => createApiKey(token!, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => revokeApiKey(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
  });
}
