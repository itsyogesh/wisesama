'use client';

import { useState } from 'react';
import { useMyReports } from '@/hooks/use-my-reports';
import { Loader2, AlertTriangle, CheckCircle, Clock, Search, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

function StatusBadge({ status }: { status: string }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
        <CheckCircle className="w-3.5 h-3.5" />
        Verified
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
        <AlertTriangle className="w-3.5 h-3.5" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400">
      <Clock className="w-3.5 h-3.5" />
      Pending
    </span>
  );
}

export default function MyReportsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyReports(page);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-white mb-2">My Reports</h1>
        <p className="text-gray-400">Track the status of fraud reports you&apos;ve submitted</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-wisesama-purple" />
        </div>
      ) : data && data.reports.length > 0 ? (
        <div className="bg-[#1F242F] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-gray-400 text-sm bg-white/5">
                <th className="p-4 font-medium">Entity</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.reports.map((report) => (
                <tr key={report.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-white text-sm max-w-[200px] truncate">
                    {report.reportedValue}
                  </td>
                  <td className="p-4 text-gray-300 text-sm">
                    {report.entityType}
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-red-300 bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                      {report.threatCategory.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {format(new Date(report.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="p-4 text-right">
                    {/* Placeholder for detail view if we add it later */}
                    <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t border-white/5">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg bg-black/20 text-white disabled:opacity-50 hover:bg-white/10 transition-colors text-sm"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-gray-400 text-sm">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                disabled={page === data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-black/20 text-white disabled:opacity-50 hover:bg-white/10 transition-colors text-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 bg-[#1F242F] border border-white/5 rounded-2xl">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-white font-medium text-lg mb-2">No Reports Found</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            You haven&apos;t submitted any fraud reports yet. Help keep the ecosystem safe by reporting suspicious activity.
          </p>
          <Link href="/report">
            <button className="px-6 py-2.5 bg-wisesama-purple hover:bg-wisesama-purple-accent text-white rounded-lg font-medium transition-colors">
              Submit a Report
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
