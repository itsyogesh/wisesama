import { Search } from 'lucide-react';
import { ResultSkeleton } from '@/components/search/result-skeleton';

/**
 * Search bar skeleton that shows during loading
 */
function SearchBarSkeleton() {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-600" />
      <div className="w-full pl-12 pr-32 py-4 rounded-xl bg-wisesama-dark-secondary border border-border">
        <div className="h-5 w-48 bg-zinc-700/30 rounded animate-pulse" />
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-lg bg-wisesama-purple/50">
        <span className="text-white/60 font-medium">Check</span>
      </div>
    </div>
  );
}

export default function CheckLoading() {
  return (
    <section className="min-h-screen bg-[#1A1A1A] py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Search Bar Skeleton */}
          <div className="mb-8">
            <SearchBarSkeleton />
          </div>

          {/* Result Skeleton */}
          <ResultSkeleton />
        </div>
      </div>
    </section>
  );
}
