import { SearchBar } from '@/components/search/search-bar';
import { ResultSkeleton } from '@/components/search/result-skeleton';

export default function Loading() {
  return (
    <section className="min-h-screen bg-[#1A1A1A] py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <SearchBar />
          </div>

          {/* Skeleton */}
          <ResultSkeleton />
        </div>
      </div>
    </section>
  );
}