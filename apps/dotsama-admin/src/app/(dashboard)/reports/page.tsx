'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { reportsApi } from '@/lib/api';
import { truncateAddress, formatDate, getStatusColor, cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface Report {
  id: string;
  entityType: string;
  reportedValue: string;
  threatCategory: string;
  status: string;
  description?: string;
  reporterEmail?: string;
  reporterName?: string;
  createdAt: string;
  user?: { id: string; email: string };
  entity?: { id: string; value: string; riskLevel: string };
}

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ReportsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', page, status],
    queryFn: () =>
      reportsApi.getAll({
        page,
        limit: 10,
        status: status || undefined,
      }),
  });

  const items = data?.reports || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const totalItems = data?.pagination?.total || 0;

  const getThreatColor = (threat: string) => {
    switch (threat?.toLowerCase()) {
      case 'scam':
      case 'phishing':
        return 'bg-red-500/20 text-red-400';
      case 'impersonation':
        return 'bg-orange-500/20 text-orange-400';
      case 'spam':
        return 'bg-yellow-500/20 text-yellow-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const columns = [
    {
      key: 'reportedValue',
      header: 'Entity',
      render: (item: Report) => (
        <div>
          <p className="font-mono text-sm">
            {item.entityType === 'ADDRESS'
              ? truncateAddress(item.reportedValue, 8)
              : item.reportedValue}
          </p>
          <p className="text-xs text-white/50 mt-1">{item.entityType}</p>
        </div>
      ),
    },
    {
      key: 'threatCategory',
      header: 'Threat',
      render: (item: Report) => (
        <span className={cn('status-badge', getThreatColor(item.threatCategory))}>
          {item.threatCategory || 'Unknown'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Report) => (
        <span className={cn('status-badge', getStatusColor(item.status))}>
          {item.status}
        </span>
      ),
    },
    {
      key: 'reporterEmail',
      header: 'Reporter',
      render: (item: Report) => (
        <span className="text-white/60">
          {item.user?.email || item.reporterEmail || 'Anonymous'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Reported',
      render: (item: Report) => (
        <span className="text-white/60">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Reports"
        description="Review fraud and scam reports"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Alert for pending reports */}
        {items.filter((r: Report) => r.status === 'pending').length > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm text-white">
              <span className="font-medium">
                {items.filter((r: Report) => r.status === 'pending').length}{' '}
              </span>
              report(s) require immediate attention
            </p>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1 p-1 bg-wisesama-dark-secondary rounded-lg w-fit">
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

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No reports found"
            keyExtractor={(item) => item.id}
            onRowClick={(item) => router.push(`/reports/${item.id}`)}
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
