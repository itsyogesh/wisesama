import type { Metadata } from 'next';
import { ResultCard } from '@/components/search/result-card';
import { SearchBar } from '@/components/search/search-bar';
import { ErrorState } from '@/components/search/error-state';

// Force dynamic rendering - no page caching
// This ensures fresh API data on every request
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ entity: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { entity } = await params;
  const decodedEntity = decodeURIComponent(entity);

  return {
    title: `Check: ${decodedEntity}`,
    description: `Risk assessment for ${decodedEntity} in the Polkadot ecosystem`,
  };
}

interface FetchResult {
  data: unknown | null;
  error: string | null;
  type: 'not-found' | 'server-error' | 'network-error' | 'rate-limit' | null;
}

async function fetchEntityCheck(entity: string): Promise<FetchResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

  try {
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

export default async function CheckPage({ params }: PageProps) {
  const { entity } = await params;
  const decodedEntity = decodeURIComponent(entity);
  const result = await fetchEntityCheck(decodedEntity);

  return (
    <section className="min-h-screen bg-[#1A1A1A] py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <SearchBar defaultValue={decodedEntity} />
          </div>

          {/* Results or Error */}
          {result.data ? (
            <ResultCard result={result.data as Parameters<typeof ResultCard>[0]['result']} />
          ) : (
            <ErrorState
              entity={decodedEntity}
              error={result.error ?? undefined}
              type={result.type ?? 'server-error'}
            />
          )}
        </div>
      </div>
    </section>
  );
}
