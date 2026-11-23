'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { whitelistRequestsApi } from '@/lib/api';
import { truncateAddress, formatDate, getStatusColor, cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface WhitelistRequest {
  id: string;
  entityType: string;
  value: string;
  name: string;
  status: string;
  requesterEmail?: string;
  createdAt: string;
  chain?: { code: string; name: string };
  user?: { id: string; email: string };
}

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(initialStatus);

  const { data, isLoading } = useQuery({
    queryKey: ['whitelist-requests', page, search, status],
    queryFn: () =>
      whitelistRequestsApi.getAll({
        page,
        limit: 10,
        search: search || undefined,
        status: status || undefined,
      }),
  });

  const items = data?.requests || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const totalItems = data?.pagination?.total || 0;

  const columns = [
    {
      key: 'name',
      header: 'Entity',
      render: (item: WhitelistRequest) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-white/50 font-mono mt-1">
            {item.entityType === 'ADDRESS'
              ? truncateAddress(item.value, 6)
              : item.value}
          </p>
        </div>
      ),
    },
    {
      key: 'entityType',
      header: 'Type',
      render: (item: WhitelistRequest) => (
        <span className="status-badge bg-wisesama-purple/20 text-wisesama-purple-light">
          {item.entityType}
        </span>
      ),
    },
    {
      key: 'chain',
      header: 'Chain',
      render: (item: WhitelistRequest) => (
        <span className="text-white/60">{item.chain?.name || 'All chains'}</span>
      ),
    },
    {
      key: 'requesterEmail',
      header: 'Requester',
      render: (item: WhitelistRequest) => (
        <span className="text-white/80">{item.user?.email || item.requesterEmail || 'Unknown'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: WhitelistRequest) => (
        <span className={cn('status-badge', getStatusColor(item.status))}>
          {item.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (item: WhitelistRequest) => (
        <span className="text-white/60">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Whitelist Requests"
        description="Review and manage whitelist submissions"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search by name, email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input-field pl-10 w-full"
            />
          </div>

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
        </div>

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No requests found"
            keyExtractor={(item) => item.id}
            onRowClick={(item) => router.push(`/requests/${item.id}`)}
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
