'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { activityApi } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import {
  Shield,
  FileText,
  CheckCircle,
  XCircle,
  Activity,
  User,
  RefreshCw,
} from 'lucide-react';

interface ActivityLog {
  id: string;
  type: string;
  description: string;
  userEmail?: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  createdAt: string;
}

const activityIcons: Record<string, typeof Shield> = {
  WHITELIST_CREATED: Shield,
  WHITELIST_UPDATED: Shield,
  WHITELIST_DELETED: Shield,
  REQUEST_SUBMITTED: FileText,
  REQUEST_APPROVED: CheckCircle,
  REQUEST_REJECTED: XCircle,
  REPORT_VERIFIED: CheckCircle,
  REPORT_REJECTED: XCircle,
  SYNC_COMPLETED: RefreshCw,
  ADMIN_LOGIN: User,
};

const activityColors: Record<string, string> = {
  WHITELIST_CREATED: 'text-green-400',
  WHITELIST_UPDATED: 'text-blue-400',
  WHITELIST_DELETED: 'text-red-400',
  REQUEST_SUBMITTED: 'text-yellow-400',
  REQUEST_APPROVED: 'text-green-400',
  REQUEST_REJECTED: 'text-red-400',
  REPORT_VERIFIED: 'text-green-400',
  REPORT_REJECTED: 'text-red-400',
  SYNC_COMPLETED: 'text-wisesama-purple',
  ADMIN_LOGIN: 'text-blue-400',
};

const typeOptions = [
  { value: '', label: 'All Activity' },
  { value: 'WHITELIST_CREATED', label: 'Whitelist Created' },
  { value: 'WHITELIST_UPDATED', label: 'Whitelist Updated' },
  { value: 'WHITELIST_DELETED', label: 'Whitelist Deleted' },
  { value: 'REQUEST_SUBMITTED', label: 'Request Submitted' },
  { value: 'REQUEST_APPROVED', label: 'Request Approved' },
  { value: 'REQUEST_REJECTED', label: 'Request Rejected' },
  { value: 'REPORT_VERIFIED', label: 'Report Verified' },
  { value: 'REPORT_REJECTED', label: 'Report Rejected' },
  { value: 'SYNC_COMPLETED', label: 'Sync Completed' },
  { value: 'ADMIN_LOGIN', label: 'Admin Login' },
];

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['activity', page, type],
    queryFn: () =>
      activityApi.getAll({
        page,
        limit: 20,
        type: type || undefined,
      }),
  });

  const items = data?.data?.items || [];
  const totalPages = data?.data?.totalPages || 1;
  const totalItems = data?.data?.total || 0;

  const columns = [
    {
      key: 'type',
      header: '',
      className: 'w-12',
      render: (item: ActivityLog) => {
        const Icon = activityIcons[item.type] || Activity;
        const colorClass = activityColors[item.type] || 'text-white/60';
        return (
          <div className="flex items-center justify-center">
            <Icon className={cn('w-5 h-5', colorClass)} />
          </div>
        );
      },
    },
    {
      key: 'description',
      header: 'Activity',
      render: (item: ActivityLog) => (
        <div>
          <p className="text-white">{item.description}</p>
          <p className="text-xs text-white/40 mt-1">
            {item.type.replace(/_/g, ' ')}
          </p>
        </div>
      ),
    },
    {
      key: 'userEmail',
      header: 'User',
      render: (item: ActivityLog) => (
        <span className="text-white/60">{item.userEmail || 'System'}</span>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (item: ActivityLog) => (
        <div className="text-sm">
          {item.entityType && (
            <span className="text-white/60">{item.entityType}</span>
          )}
          {item.entityId && (
            <p className="text-xs text-white/40 font-mono truncate max-w-[120px]">
              {item.entityId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (item: ActivityLog) => (
        <span className="text-white/40 text-sm font-mono">
          {item.ipAddress || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (item: ActivityLog) => (
        <span className="text-white/60 text-sm">
          {formatDateTime(item.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Activity Log"
        description="Audit trail of all platform activity"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="input-field min-w-[200px]"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No activity found"
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
