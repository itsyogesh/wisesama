'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { whitelistApi } from '@/lib/api';
import { truncateAddress, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, Search, Filter } from 'lucide-react';

interface WhitelistEntity {
  id: string;
  entityType: string;
  value: string;
  name: string;
  category: string;
  chain?: { name: string };
  createdAt: string;
}

export default function WhitelistPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['whitelist', page, search, entityType],
    queryFn: () =>
      whitelistApi.getAll({
        page,
        limit: 10,
        search: search || undefined,
        entityType: entityType || undefined,
      }),
  });

  const items = data?.data?.entities || [];
  const totalPages = data?.data?.pagination?.totalPages || 1;
  const totalItems = data?.data?.pagination?.total || 0;

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: WhitelistEntity) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-white/50">{item.category}</p>
        </div>
      ),
    },
    {
      key: 'entityType',
      header: 'Type',
      render: (item: WhitelistEntity) => (
        <span className="status-badge bg-wisesama-purple/20 text-wisesama-purple-light">
          {item.entityType}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (item: WhitelistEntity) => (
        <span className="font-mono text-sm text-white/80">
          {item.entityType === 'ADDRESS'
            ? truncateAddress(item.value, 8)
            : item.value}
        </span>
      ),
    },
    {
      key: 'chain',
      header: 'Chain',
      render: (item: WhitelistEntity) => (
        <span className="text-white/60">{item.chain?.name || 'All chains'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Added',
      render: (item: WhitelistEntity) => (
        <span className="text-white/60">{formatDate(item.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Whitelist"
        description="Manage whitelisted entities"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search by name, value..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input-field pl-10 w-full"
              />
            </div>

            {/* Type filter */}
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="input-field min-w-[150px]"
            >
              <option value="">All types</option>
              <option value="ADDRESS">Address</option>
              <option value="DOMAIN">Domain</option>
              <option value="TWITTER">Twitter</option>
            </select>
          </div>

          <Button onClick={() => router.push('/whitelist/new')}>
            <Plus className="w-4 h-4" />
            Add Entity
          </Button>
        </div>

        {/* Table */}
        <div className="glass-card">
          <DataTable
            columns={columns}
            data={items}
            isLoading={isLoading}
            emptyMessage="No whitelisted entities found"
            keyExtractor={(item) => item.id}
            onRowClick={(item) => router.push(`/whitelist/${item.id}`)}
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
