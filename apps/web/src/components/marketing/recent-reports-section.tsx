'use client';

import { Copy, ShieldAlert, ShieldCheck, Activity, ExternalLink } from 'lucide-react';
import { useRecentFlaggedEntities } from '@/hooks/use-reports';
import { motion } from 'motion/react';
import Balancer from 'react-wrap-balancer';

function truncateAddress(address: string): string {
  if (address.length <= 24) return address;
  return `${address.slice(0, 12)}...${address.slice(-10)}`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Mock data for display when API returns empty
const DEMO_THREATS = [
  {
    id: 'demo-1',
    value: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
    entityType: 'ADDRESS',
    riskLevel: 'FRAUD',
    threatCategory: 'Phishing',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
  },
  {
    id: 'demo-2',
    value: 'polkadot-staking-bonus.com',
    entityType: 'DOMAIN',
    riskLevel: 'FRAUD',
    threatCategory: 'Scam',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
  },
  {
    id: 'demo-3',
    value: '@PolkadotSupp0rt_Official',
    entityType: 'TWITTER',
    riskLevel: 'CAUTION',
    threatCategory: 'Impersonation',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
  },
  {
    id: 'demo-4',
    value: '13UVJyLnbVp77Z2t6r2dFKqddAo3cATaBG6YMuEsWbbmFivP',
    entityType: 'ADDRESS',
    riskLevel: 'FRAUD',
    threatCategory: 'Rug Pull',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
  },
  {
    id: 'demo-5',
    value: 'claim-dotsama-airdrop.xyz',
    entityType: 'DOMAIN',
    riskLevel: 'FRAUD',
    threatCategory: 'Phishing',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
  },
];

export function RecentReportsSection() {
  const { data, isLoading } = useRecentFlaggedEntities(6);

  // Use real data if available, otherwise fallback to demo data
  const displayEntities = (data?.entities && data.entities.length > 0) 
    ? data.entities 
    : DEMO_THREATS;

  return (
    <section className="py-24 bg-wisesama-bg relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-wisesama-purple/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-wisesama-pink-glow/5 blur-[100px] rounded-full pointer-events-none" />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ 
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20">
              <ShieldAlert className="w-4 h-4 text-wisesama-purple-light" />
              <span className="text-sm font-medium text-wisesama-purple-light">
                Live Threat Feed
              </span>
            </div>
            <h2 className="font-heading font-semibold text-4xl md:text-5xl text-white">
              <Balancer>
                Latest Detected <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">Threats</span>
              </Balancer>
            </h2>
            <p className="text-gray-400 max-w-xl text-lg">
              <Balancer>
                Real-time feed of malicious addresses, domains, and impersonators flagged by the Wisesama community and ML engine.
              </Balancer>
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="bg-zinc-900/80 backdrop-blur border border-white/10 p-4 rounded-xl">
              <div className="text-2xl font-heading font-bold text-white mb-1">24h</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Detection Time</div>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur border border-white/10 p-4 rounded-xl">
              <div className="text-2xl font-heading font-bold text-wisesama-status-fraud mb-1">98%</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Accuracy Score</div>
            </div>
          </div>
        </div>

        {/* Feed List */}
        <div className="grid gap-4 max-w-5xl mx-auto">
          {isLoading ? (
            // Loading Skeletons
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-zinc-900/50 rounded-xl border border-white/5 animate-pulse" />
            ))
          ) : (
            displayEntities.map((entity, index) => (
              <motion.div
                key={entity.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-wisesama-purple/30 rounded-xl p-4 transition-all duration-300 backdrop-blur-sm"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  {/* Icon / Type */}
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    entity.riskLevel === 'FRAUD' 
                      ? 'bg-red-500/10 text-red-400' 
                      : 'bg-orange-500/10 text-orange-400'
                  }`}>
                    {entity.riskLevel === 'FRAUD' ? <ShieldAlert className="w-5 h-5" /> : <Activity className="w-5 h-5" />}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0 grid md:grid-cols-[2fr_1fr_1fr] gap-4 w-full">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-mono text-sm truncate bg-black/30 px-2 py-1 rounded border border-white/5">
                          {truncateAddress(entity.value)}
                        </span>
                        <button
                          onClick={() => navigator.clipboard.writeText(entity.value)}
                          className="text-gray-500 hover:text-white transition-colors p-1"
                          title="Copy address"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="uppercase tracking-wider font-medium">{entity.entityType}</span>
                        <span>•</span>
                        <span>{entity.threatCategory ? entity.threatCategory : 'Suspicious Activity'}</span>
                      </div>
                    </div>

                    {/* Risk Badge */}
                    <div className="flex items-center">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
                        entity.riskLevel === 'FRAUD'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-orange-500/10 border-orange-500/20 text-orange-400'
                      }`}>
                        {entity.riskLevel === 'FRAUD' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                        {entity.riskLevel}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center justify-between md:justify-end gap-4">
                      <span className="text-sm text-gray-400 font-medium">
                        {formatTimeAgo(entity.createdAt)}
                      </span>
                      <a 
                        href={`/check/${entity.value}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-white/10 rounded-lg text-wisesama-purple-light"
                        title="View Analysis"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
