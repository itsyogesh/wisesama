import { ResultCard } from './result-card';
import { ErrorState } from './error-state';

interface FetchResult {
  data: any | null;
  error: string | null;
  type: 'not-found' | 'server-error' | 'network-error' | 'rate-limit' | null;
}

async function fetchEntityCheck(entity: string): Promise<FetchResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

  try {
    // Add a small artificial delay to ensure the transition is noticeable if the API is too fast
    // and to test the skeleton state. In production, remove this if not needed.
    // await new Promise(r => setTimeout(r, 500)); 

    const res = await fetch(`${apiUrl}/api/v1/check/${encodeURIComponent(entity)}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { data: null, error: 'Entity not found', type: 'not-found' };
      }
      if (res.status === 429) {
        return { data: null, error: 'Rate limit exceeded', type: 'rate-limit' };
      }
      return { data: null, error: `Server error: ${res.status}`, type: 'server-error' };
    }

    const json = await res.json();
    return { data: json.data || json, error: null, type: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { data: null, error: errorMessage, type: 'network-error' };
  }
}

export async function RiskReport({ entity }: { entity: string }) {
  const result = await fetchEntityCheck(entity);

  if (result.data) {
    return <ResultCard result={result.data} />;
  }

  return (
    <ErrorState
      entity={entity}
      error={result.error ?? undefined}
      type={result.type ?? 'server-error'}
    />
  );
}
