import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { ResultCard } from '@/components/search/result-card';

export const metadata: Metadata = {
  title: 'Check Entity',
  description: 'Check addresses, domains, and social handles against our fraud database',
};

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

async function fetchEntityCheck(entity: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://wisesama-api.vercel.app';

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

export default async function CheckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim();

  // If there's a query parameter, redirect to the entity-specific URL
  if (query) {
    redirect(`/check/${encodeURIComponent(query)}`);
  }

  return (
    <section className="min-h-screen bg-[#1A1A1A] py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-heading font-bold text-3xl md:text-4xl text-white mb-4">
              Check Entity
            </h1>
            <p className="text-gray-400">
              Enter an address, domain, or social handle to check its risk status
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <SearchBar />
          </div>

          {/* Empty state */}
          <div className="text-center py-12">
            <p className="text-gray-400">
              Enter an address or domain above to check its status
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
