import { Flag, Search, Clock } from 'lucide-react';
import type { EntityStats } from '@wisesama/types';

interface StatsSectionProps {
  stats: EntityStats;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'Never';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function StatsSection({ stats }: StatsSectionProps) {
  const hasReports = stats.userReports > 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Reported by Users */}
      <div className={`relative p-4 rounded-xl border overflow-hidden transition-colors ${
        hasReports
          ? 'bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20'
          : 'bg-zinc-800/30 border-zinc-800/50 hover:border-zinc-700/50'
      }`}>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Flag className={`h-4 w-4 ${hasReports ? 'text-red-400' : 'text-gray-600'}`} />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Reports</p>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${hasReports ? 'text-red-400' : 'text-emerald-400'}`}>
            {stats.userReports}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">by users</p>
        </div>
      </div>

      {/* Times Searched */}
      <div className="relative p-4 rounded-xl bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors overflow-hidden">
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-gray-600" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Searches</p>
          </div>
          <p className="text-3xl font-bold text-wisesama-purple-light tabular-nums">
            {stats.timesSearched}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">total lookups</p>
        </div>
      </div>

      {/* Last Searched */}
      <div className="relative p-4 rounded-xl bg-zinc-800/30 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors overflow-hidden">
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-gray-600" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Last Check</p>
          </div>
          <p className="text-lg font-bold text-gray-300">
            {formatDate(stats.lastSearched)}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">most recent</p>
        </div>
      </div>
    </div>
  );
}
