import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchBar } from '@/components/search/search-bar';
import { RiskReport } from '@/components/search/risk-report';
import { ResultSkeleton } from '@/components/search/result-skeleton';

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

export default async function CheckPage({ params }: PageProps) {
  const { entity } = await params;
  const decodedEntity = decodeURIComponent(entity);

  return (
    <section className="min-h-screen bg-[#1A1A1A] py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <SearchBar defaultValue={decodedEntity} />
          </div>

          {/* Async Risk Report with Suspense */}
          <Suspense fallback={<ResultSkeleton />}>
            <RiskReport entity={decodedEntity} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
