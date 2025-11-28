'use client';

import { Copy, ExternalLink } from 'lucide-react';
import { useVerifiedReports } from '@/hooks/use-reports';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RecentReportsSection() {
  const { data, isLoading } = useVerifiedReports(1, 5);

  return (
    <section className="py-16 bg-wisesama-bg">
      {/* Purple glow effect */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-section-glow opacity-50 pointer-events-none"
        style={{ filter: 'blur(95px)' }}
      />

      <div className="container mx-auto px-4 relative">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-4">
            Checkout the last reported
            <br />
            addresses, tokens
          </h2>
        </div>

        {/* Table */}
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-gray-400 font-semibold">Address</TableHead>
                  <TableHead className="text-gray-400 font-semibold">Reported</TableHead>
                  <TableHead className="text-gray-400 font-semibold text-center">Type</TableHead>
                  <TableHead className="text-gray-400 font-semibold text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Skeleton loading
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="border-b border-zinc-800/50">
                      <TableCell>
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-40" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-24" />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-16 mx-auto" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="h-4 bg-zinc-800 rounded animate-pulse w-20 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.reports && data.reports.length > 0 ? (
                  data.reports.map((report) => (
                    <TableRow key={report.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <TableCell className="text-white">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {truncateAddress(report.reportedValue)}
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(report.reportedValue)}
                            className="text-gray-500 hover:text-white transition-colors"
                            title="Copy address"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {formatDate(report.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-purple-600/20 text-purple-400">
                          {report.entityType}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          report.status === 'VERIFIED'
                            ? 'bg-red-600/20 text-red-400'
                            : 'bg-yellow-600/20 text-yellow-400'
                        }`}>
                          {report.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                      No reports found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </section>
  );
}
