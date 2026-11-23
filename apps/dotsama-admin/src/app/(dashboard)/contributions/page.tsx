'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { contributionsApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  GitPullRequest,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Contribution {
  id: string;
  prNumber: number | null;
  prUrl: string | null;
  prStatus: string;
  entityType: string;
  entityValue: string;
  targetFile: string;
  submittedAt: string;
  mergedAt: string | null;
  errorMessage: string | null;
}

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'open', label: 'Open' },
  { value: 'merged', label: 'Merged' },
  { value: 'closed', label: 'Closed' },
  { value: 'error', label: 'Error' },
];

export default function ContributionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contributions', page, status],
    queryFn: () =>
      contributionsApi.getAll({
        page,
        limit: 20,
        status: status || undefined,
      }),
  });

  const { data: configData } = useQuery({
    queryKey: ['contributions-config'],
    queryFn: contributionsApi.getConfig,
  });

  const syncAllMutation = useMutation({
    mutationFn: contributionsApi.syncAll,
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} contribution(s)`);
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to sync contributions');
    },
  });

  const items = data?.contributions || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const totalItems = data?.pagination?.total || 0;
  const statusCounts = data?.statusCounts || {};
  const isConfigured = configData?.configured ?? false;

  const getStatusIcon = (prStatus: string) => {
    switch (prStatus) {
      case 'merged':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'closed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'open':
        return <GitPullRequest className="w-5 h-5 text-blue-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (prStatus: string) => {
    switch (prStatus) {
      case 'merged':
        return 'bg-green-500/20 text-green-400';
      case 'closed':
        return 'bg-red-500/20 text-red-400';
      case 'open':
        return 'bg-blue-500/20 text-blue-400';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'error':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const columns = [
    {
      key: 'status',
      header: '',
      className: 'w-12',
      render: (item: Contribution) => (
        <div className="flex items-center justify-center">
          {getStatusIcon(item.prStatus)}
        </div>
      ),
    },
    {
      key: 'prNumber',
      header: 'PR',
      render: (item: Contribution) => (
        <div>
          {item.prNumber ? (
            <a
              href={item.prUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-wisesama-purple hover:text-wisesama-purple-light transition-colors"
            >
              #{item.prNumber}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <span className="text-white/40">-</span>
          )}
        </div>
      ),
    },
    {
      key: 'entityValue',
      header: 'Entity',
      render: (item: Contribution) => (
        <div>
          <p className="font-mono text-sm text-white truncate max-w-[200px]">
            {item.entityValue}
          </p>
          <p className="text-xs text-white/50 mt-1">{item.entityType}</p>
        </div>
      ),
    },
    {
      key: 'targetFile',
      header: 'Target',
      render: (item: Contribution) => (
        <span className="text-white/60 text-sm">{item.targetFile}</span>
      ),
    },
    {
      key: 'prStatus',
      header: 'Status',
      render: (item: Contribution) => (
        <span className={cn('status-badge', getStatusColor(item.prStatus))}>
          {item.prStatus}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (item: Contribution) => (
        <span className="text-white/60">{formatDate(item.submittedAt)}</span>
      ),
    },
    {
      key: 'mergedAt',
      header: 'Merged',
      render: (item: Contribution) => (
        <span className="text-white/60">
          {item.mergedAt ? formatDate(item.mergedAt) : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="GitHub Contributions"
        description="PRs to polkadot-js/phishing repository"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Config status banner */}
        {!isConfigured && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-white">
              GitHub integration is not configured. Set <code className="bg-white/10 px-1 rounded">GITHUB_TOKEN</code> and <code className="bg-white/10 px-1 rounded">GITHUB_FORK_OWNER</code> environment variables to enable automatic PR creation.
            </p>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="glass-card p-4">
            <p className="text-sm text-white/60">Total</p>
            <p className="text-2xl font-heading font-bold text-white mt-1">
              {totalItems}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-white/60">Pending</p>
            <p className="text-2xl font-heading font-bold text-yellow-400 mt-1">
              {statusCounts.pending || 0}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-white/60">Open</p>
            <p className="text-2xl font-heading font-bold text-blue-400 mt-1">
              {statusCounts.open || 0}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-white/60">Merged</p>
            <p className="text-2xl font-heading font-bold text-green-400 mt-1">
              {statusCounts.merged || 0}
            </p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-white/60">Closed/Error</p>
            <p className="text-2xl font-heading font-bold text-red-400 mt-1">
              {(statusCounts.closed || 0) + (statusCounts.error || 0)}
            </p>
          </div>
        </div>

        {/* Filters and actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Status filter tabs */}
          <div className="flex gap-1 p-1 bg-wisesama-dark-secondary rounded-lg">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setStatus(option.value);
                  setPage(1);
                }}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  status === option.value
                    ? 'bg-wisesama-purple text-white'
                    : 'text-white/60 hover:text-white'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Sync button */}
          <Button
            variant="outline"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending || !isConfigured}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', syncAllMutation.isPending && 'animate-spin')} />
            {syncAllMutation.isPending ? 'Syncing...' : 'Sync All Open PRs'}
          </Button>
        </div>

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No contributions found"
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
