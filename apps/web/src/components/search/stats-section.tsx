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
  const reportColor = stats.userReports > 0 ? 'text-red-400' : 'text-green-400';

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Reported by Users */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
        <p className={`text-3xl font-bold ${reportColor}`}>
          {stats.userReports}
        </p>
        <p className="text-xs text-gray-500 mt-1">Reported by Users</p>
      </div>

      {/* Times Searched */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
        <p className="text-3xl font-bold text-purple-400">
          {stats.timesSearched}
        </p>
        <p className="text-xs text-gray-500 mt-1">Times Searched</p>
      </div>

      {/* Last Searched */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
        <p className="text-lg font-bold text-purple-400">
          {formatDate(stats.lastSearched)}
        </p>
        <p className="text-xs text-gray-500 mt-1">Last Searched</p>
      </div>
    </div>
  );
}
