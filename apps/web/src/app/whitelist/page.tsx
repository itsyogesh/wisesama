'use client';

import { useState } from 'react';
import { useWhitelist } from '@/hooks/use-whitelist';
import { Search, Globe, Twitter, ExternalLink, ShieldCheck, Wallet, Mail } from 'lucide-react';
import Link from 'next/link';
import Balancer from 'react-wrap-balancer';

function EntityTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'ADDRESS':
      return <Wallet className="w-4 h-4" />;
    case 'DOMAIN':
      return <Globe className="w-4 h-4" />;
    case 'TWITTER':
      return <Twitter className="w-4 h-4" />;
    case 'EMAIL':
      return <Mail className="w-4 h-4" />;
    default:
      return <ShieldCheck className="w-4 h-4" />;
  }
}

export default function WhitelistPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useWhitelist({ page, search, limit: 20 });

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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 text-xs font-medium text-wisesama-purple-light uppercase tracking-wider mb-6">
              <ShieldCheck className="w-4 h-4" />
              <span>Trusted Entities</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-semibold text-white mb-4">
              <Balancer>
                Whitelist <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">Directory</span>
              </Balancer>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              <Balancer>
                A curated list of verified projects, exchanges, and infrastructure providers in the Polkadot ecosystem.
              </Balancer>
            </p>
          </div>

          {/* Search */}
          <div className="mb-10 relative max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Search projects, addresses, or domains..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to page 1 on search
                }}
                className="w-full bg-[#1F242F] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-wisesama-purple/50 transition-all"
              />
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-[#1F242F] h-40 rounded-xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-400 bg-red-500/5 rounded-xl border border-red-500/10">
              Failed to load whitelist directory. Please try again later.
            </div>
          ) : data?.entities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-[#1F242F] rounded-xl border border-white/5">
              No entities found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.entities.map((entity) => (
                <div
                  key={entity.id}
                  className="bg-[#1F242F] border border-white/5 rounded-xl p-6 hover:border-wisesama-purple/30 transition-colors group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {entity.logoUrl ? (
                        <img src={entity.logoUrl} alt={entity.name} className="w-10 h-10 rounded-full bg-black/20" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-wisesama-purple/20 flex items-center justify-center text-wisesama-purple-light font-bold text-lg">
                          {entity.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h3 className="font-heading font-semibold text-white text-lg">{entity.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                            {entity.category}
                          </span>
                          <span className="text-[10px] text-wisesama-purple-light uppercase tracking-wider bg-wisesama-purple/10 border border-wisesama-purple/20 px-2 py-0.5 rounded flex items-center gap-1">
                            <EntityTypeIcon type={entity.entityType} />
                            {entity.entityType}
                          </span>
                        </div>
                      </div>
                    </div>
                    {entity.chain && (
                      <span className="text-xs font-mono text-gray-500 border border-white/10 px-2 py-1 rounded">
                        {entity.chain.name}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-300 font-mono break-all bg-black/40 p-3 rounded-lg border border-white/5 group-hover:border-white/10 transition-colors">
                      <EntityTypeIcon type={entity.entityType} />
                      {entity.value}
                    </div>
                    {entity.description && (
                      <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{entity.description}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-white/5">
                    {entity.website && (
                      <a
                        href={entity.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-wisesama-purple-light flex items-center gap-1.5 transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Website
                      </a>
                    )}
                    {entity.twitter && (
                      <a
                        href={`https://twitter.com/${entity.twitter.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                      >
                        <Twitter className="w-3.5 h-3.5" />
                        Twitter
                      </a>
                    )}
                    <Link
                      href={`/check/${entity.value}`}
                      className="ml-auto text-xs font-medium text-wisesama-purple-light hover:text-white flex items-center gap-1.5 transition-colors bg-wisesama-purple/10 hover:bg-wisesama-purple/20 px-3 py-1.5 rounded-lg"
                    >
                      Analyze Risk
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
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
