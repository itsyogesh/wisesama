import { useMutation } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

interface WhitelistRequestData {
  entityType: 'ADDRESS' | 'DOMAIN' | 'TWITTER';
  value: string;
  chainCode?: string;
  name: string;
  category: string;
  description?: string;
  website?: string;
  twitter?: string;
  logoUrl?: string;
  requesterName?: string;
  requesterEmail: string;
  requesterOrg?: string;
  evidenceUrls?: string[];
  verificationNotes?: string;
}

async function submitWhitelistRequest(data: WhitelistRequestData) {
  const res = await fetch(`${API_URL}/api/v1/whitelist/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || error.error || 'Failed to submit request');
  }

  const json = await res.json();
  return json.data || json;
}

export function useWhitelistRequest() {
  return useMutation({
    mutationFn: submitWhitelistRequest,
  });
}
