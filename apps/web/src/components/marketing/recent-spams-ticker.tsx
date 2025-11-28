'use client';

import { useRecentReports } from '@/hooks/use-reports';

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function RecentSpamsTicker() {
  const { data, isLoading } = useRecentReports(20);

  if (isLoading || !data?.reports || data.reports.length === 0) {
    return null;
  }

  const reports = data.reports;
  // Duplicate the content for seamless infinite scroll
  const tickerContent = [...reports, ...reports];

  return (
    <section className="py-4 bg-purple-900/30 border-y border-purple-500/20 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-4">
          {/* Label */}
          <span className="shrink-0 font-heading font-bold text-sm text-white uppercase tracking-wider">
            Recent Spams:
          </span>

          {/* Scrolling addresses */}
          <div className="overflow-hidden flex-1 relative">
            <div className="animate-scroll-left flex items-center gap-4 whitespace-nowrap">
              {tickerContent.map((report, index) => (
                <span key={`${report.reportedValue}-${index}`} className="flex items-center gap-4">
                  <span className="text-gray-300 text-sm font-mono">
                    {truncateAddress(report.reportedValue)}
                  </span>
                  {index < tickerContent.length - 1 && (
                    <span className="text-purple-400">|</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
