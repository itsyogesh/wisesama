'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { apiClient } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Search, Award, Trophy, Medal } from 'lucide-react';

interface Contributor {
  id: string;
  walletAddress: string;
  email?: string;
  verifiedReports: number;
  whitelistContributions: number;
  totalPoints: number;
  rank: number;
  createdAt: string;
}

export default function ContributionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contributors', page, search],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/admin/contributors', {
        params: { page, limit: 20, search: search || undefined },
      });
      return response.data;
    },
  });

  const items = data?.data?.items || [];
  const totalPages = data?.data?.totalPages || 1;
  const totalItems = data?.data?.total || 0;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-white/40 font-mono">#{rank}</span>;
  };

  const columns = [
    {
      key: 'rank',
      header: 'Rank',
      className: 'w-16',
      render: (item: Contributor) => (
        <div className="flex items-center justify-center">
          {getRankIcon(item.rank)}
        </div>
      ),
    },
    {
      key: 'walletAddress',
      header: 'Contributor',
      render: (item: Contributor) => (
        <div>
          <p className="font-mono text-sm text-white">
            {item.walletAddress.slice(0, 8)}...{item.walletAddress.slice(-6)}
          </p>
          {item.email && (
            <p className="text-xs text-white/40 mt-1">{item.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'verifiedReports',
      header: 'Verified Reports',
      render: (item: Contributor) => (
        <span className="text-white">{item.verifiedReports}</span>
      ),
    },
    {
      key: 'whitelistContributions',
      header: 'Whitelist Contribs',
      render: (item: Contributor) => (
        <span className="text-white">{item.whitelistContributions}</span>
      ),
    },
    {
      key: 'totalPoints',
      header: 'Points',
      render: (item: Contributor) => (
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-wisesama-purple" />
          <span className="font-medium text-white">{item.totalPoints}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (item: Contributor) => (
        <span className="text-white/60">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contributions"
        description="Community contributor rankings and rewards"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-6">
            <p className="text-sm text-white/60">Total Contributors</p>
            <p className="text-3xl font-heading font-bold text-white mt-2">
              {totalItems}
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-sm text-white/60">Reports This Month</p>
            <p className="text-3xl font-heading font-bold text-white mt-2">
              {data?.data?.monthlyReports || 0}
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-sm text-white/60">Points Awarded</p>
            <p className="text-3xl font-heading font-bold text-white mt-2">
              {data?.data?.totalPoints || 0}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search by wallet or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field pl-10 w-full"
          />
        </div>

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No contributors found"
            keyExtractor={(item) => item.id}
            pagination={{
              page,
              totalPages,
              totalItems,
              onPageChange: setPage,
            }}
          />
        </div>
      </div>
    </div>
  );
}
