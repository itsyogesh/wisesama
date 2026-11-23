'use client';

import { useState } from 'react';
import { useBlacklist } from '@/hooks/use-blacklist';
import { Search, AlertTriangle, ShieldAlert, Copy } from 'lucide-react';
import Link from 'next/link';
import Balancer from 'react-wrap-balancer';

export default function BlacklistPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useBlacklist({ page, search, limit: 20 });

  return (
    <div
      className="min-h-screen bg-wisesama-bg"
      style={{
        backgroundImage: 'url(/newbg.png)',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-medium text-red-400 uppercase tracking-wider mb-6">
              <ShieldAlert className="w-4 h-4" />
              <span>Risk Database</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-semibold text-white mb-4">
              <Balancer>
                Known <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">Scammers</span>
              </Balancer>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              <Balancer>
                A database of known malicious addresses, domains, and social handles involved in phishing, scams, and rug pulls.
              </Balancer>
            </p>
          </div>

          {/* Search */}
          <div className="mb-10 relative max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search address or domain..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#1F242F] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
              />
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#1F242F] h-24 rounded-xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-400 bg-red-500/5 rounded-xl border border-red-500/10">
              Failed to load blacklist. Please try again later.
            </div>
          ) : data?.entities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-[#1F242F] rounded-xl border border-white/5">
              No entities found matching your search.
            </div>
          ) : (
            <div className="bg-[#1F242F] border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-sm">
                      <th className="p-4 font-medium">Entity</th>
                      <th className="p-4 font-medium">Type</th>
                      <th className="p-4 font-medium">Threat</th>
                      <th className="p-4 font-medium text-right">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data?.entities.map((entity) => (
                      <tr key={entity.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-sm max-w-[200px] md:max-w-md truncate">
                              {entity.value}
                            </span>
                            <button
                              onClick={() => navigator.clipboard.writeText(entity.value)}
                              className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded border border-white/5">
                            {entity.entityType}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm text-red-300">
                            {entity.threatCategory || entity.threatName || 'Suspicious'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                            entity.riskLevel === 'FRAUD'
                              ? 'bg-red-500/10 border-red-500/20 text-red-400'
                              : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                          }`}>
                            {entity.riskLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-lg bg-[#1F242F] text-white disabled:opacity-50 hover:bg-white/10 transition-colors"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-400">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                disabled={page === data.pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-lg bg-[#1F242F] text-white disabled:opacity-50 hover:bg-white/10 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
