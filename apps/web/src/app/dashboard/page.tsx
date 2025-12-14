'use client';

import { useAuthStore } from '@/stores/use-auth-store';
import { useApiKeys } from '@/hooks/use-api-keys';
import { ShieldCheck, Zap, Activity } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: keys } = useApiKeys();

  const activeKeys = keys?.filter((k) => k.isActive).length || 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-white mb-2">Overview</h1>
        <p className="text-gray-400">Welcome back, {user?.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Account Tier */}
        <div className="bg-[#1F242F] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">Plan</h3>
            <ShieldCheck className="w-5 h-5 text-wisesama-purple-light" />
          </div>
          <div className="text-2xl font-bold text-white capitalize">{user?.tier || 'Free'}</div>
          <p className="text-xs text-gray-500 mt-1">Standard protection</p>
        </div>

        {/* Quota */}
        <div className="bg-[#1F242F] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">Monthly Quota</h3>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {user?.remainingQuota?.toLocaleString() || 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">Requests remaining</p>
        </div>

        {/* API Keys */}
        <div className="bg-[#1F242F] border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">Active Keys</h3>
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">{activeKeys} / 5</div>
          <p className="text-xs text-gray-500 mt-1">
            <Link href="/dashboard/api-keys" className="text-wisesama-purple-light hover:text-white transition-colors">
              Manage keys &rarr;
            </Link>
          </p>
        </div>
      </div>

      {/* Quick Start / Docs */}
      <div className="bg-gradient-to-r from-wisesama-purple/10 to-transparent border border-wisesama-purple/20 p-8 rounded-2xl">
        <h2 className="font-heading text-xl font-bold text-white mb-2">Start Building</h2>
        <p className="text-gray-300 max-w-2xl mb-6">
          Integrate Wisesama&apos;s fraud detection directly into your dApp. Check out our API documentation to get started with the `/check` endpoint.
        </p>
        <Link 
          href="/docs"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-wisesama-purple text-white font-medium rounded-lg hover:bg-wisesama-purple-accent transition-colors"
        >
          View Documentation
        </Link>
      </div>
    </div>
  );
}
