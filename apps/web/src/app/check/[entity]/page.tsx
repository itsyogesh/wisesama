import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ResultCard } from '@/components/search/result-card';
import { ResultSkeleton } from '@/components/search/result-skeleton';
import { SearchBar } from '@/components/search/search-bar';

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

async function fetchEntityCheck(entity: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.wisesama.com';

  try {
    const res = await fetch(`${apiUrl}/api/v1/check/${encodeURIComponent(entity)}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.data || json;
  } catch (error) {
    console.error('Failed to fetch entity check:', error);
    return null;
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

          {/* Results */}
          <Suspense fallback={<ResultSkeleton />}>
            {result ? (
              <ResultCard result={result} />
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">
                  Unable to check this entity. Please try again later.
                </p>
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </section>
  );
}
