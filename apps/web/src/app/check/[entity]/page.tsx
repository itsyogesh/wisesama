import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ResultCard } from '@/components/search/result-card';
import { SearchBar } from '@/components/search/search-bar';

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            {/* Search Bar */}
            <div className="mb-8">
              <SearchBar defaultValue={decodedEntity} />
            </div>

            {/* Results */}
            <Suspense
              fallback={
                <div className="animate-pulse">
                  <div className="h-64 bg-wisesama-dark-secondary rounded-xl" />
                </div>
              }
            >
              {result ? (
                <ResultCard result={result} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Unable to check this entity. Please try again later.
                  </p>
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
