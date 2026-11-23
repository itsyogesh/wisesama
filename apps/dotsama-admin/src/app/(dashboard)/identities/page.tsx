'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { identitiesApi } from '@/lib/api';
import { truncateAddress, formatDate, cn } from '@/lib/utils';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Twitter,
  Github,
  Globe,
  Loader2,
} from 'lucide-react';

interface Identity {
  id: string;
  address: string;
  source: string;
  displayName: string | null;
  legalName: string | null;
  twitter: string | null;
  github: string | null;
  web: string | null;
  isVerified: boolean;
  hasIdentity: boolean;
  lastSyncedAt: string | null;
  chain?: { name: string };
}

export default function IdentitiesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [chain, setChain] = useState('');
  const [verified, setVerified] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['identities', page, search, chain, verified],
    queryFn: () =>
      identitiesApi.getAll({
        page,
        limit: 20,
        search: search || undefined,
        chain: chain || undefined,
        verified: verified || undefined,
      }),
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['identity-sync-status'],
    queryFn: identitiesApi.getSyncStatus,
  });

  const syncMutation = useMutation({
    mutationFn: () => identitiesApi.triggerSyncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
    },
  });

  const items = data?.data?.identities || [];
  const totalPages = data?.data?.pagination?.totalPages || 1;
  const totalItems = data?.data?.pagination?.total || 0;
  const sync = syncStatus?.data || syncStatus || {};

  const columns = [
    {
      key: 'displayName',
      header: 'Identity',
      render: (item: Identity) => (
        <div>
          <p className="font-medium">
            {item.displayName || '(No display name)'}
          </p>
          <p className="text-xs text-white/50 font-mono">
            {truncateAddress(item.address, 8)}
          </p>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Chain',
      render: (item: Identity) => (
        <span
          className={cn(
            'status-badge',
            item.source === 'POLKADOT_PEOPLE'
              ? 'bg-pink-500/20 text-pink-300'
              : 'bg-gray-500/20 text-gray-300'
          )}
        >
          {item.source === 'POLKADOT_PEOPLE' ? 'Polkadot' : 'Kusama'}
        </span>
      ),
    },
    {
      key: 'isVerified',
      header: 'Verified',
      render: (item: Identity) =>
        item.isVerified ? (
          <CheckCircle2 className="w-4 h-4 text-wisesama-status-safe" />
        ) : (
          <XCircle className="w-4 h-4 text-white/20" />
        ),
    },
    {
      key: 'socials',
      header: 'Social',
      render: (item: Identity) => (
        <div className="flex items-center gap-2">
          {item.twitter && (
            <Twitter className="w-3.5 h-3.5 text-blue-400" />
          )}
          {item.github && (
            <Github className="w-3.5 h-3.5 text-white/60" />
          )}
          {item.web && (
            <Globe className="w-3.5 h-3.5 text-white/40" />
          )}
          {!item.twitter && !item.github && !item.web && (
            <span className="text-white/20 text-xs">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'lastSyncedAt',
      header: 'Synced',
      render: (item: Identity) => (
        <span className="text-white/60 text-sm">
          {item.lastSyncedAt ? formatDate(item.lastSyncedAt) : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="On-chain Identities"
        description="Browse and manage synced People Chain identities"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Sync Status Bar */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-white/50">Polkadot</p>
                <p className="text-lg font-semibold text-white">
                  {sync.identities?.polkadot?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Kusama</p>
                <p className="text-lg font-semibold text-white">
                  {sync.identities?.kusama?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Total</p>
                <p className="text-lg font-semibold text-wisesama-purple-light">
                  {sync.identities?.total?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <p className="text-xs text-white/50">Last Synced</p>
                <p className="text-sm text-white/80">
                  {sync.lastSyncedAt
                    ? formatDate(sync.lastSyncedAt)
                    : 'Never'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search by name, address, twitter, github..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input-field pl-10 w-full"
              />
            </div>

            <select
              value={chain}
              onChange={(e) => {
                setChain(e.target.value);
                setPage(1);
              }}
              className="input-field min-w-[140px]"
            >
              <option value="">All chains</option>
              <option value="polkadot">Polkadot</option>
              <option value="kusama">Kusama</option>
            </select>

            <select
              value={verified}
              onChange={(e) => {
                setVerified(e.target.value);
                setPage(1);
              }}
              className="input-field min-w-[140px]"
            >
              <option value="">All status</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No identities found"
            keyExtractor={(item) => item.id}
            onRowClick={(item) => router.push(`/identities/${item.id}`)}
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
