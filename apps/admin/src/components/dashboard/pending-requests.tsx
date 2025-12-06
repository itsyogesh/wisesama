'use client';

import Link from 'next/link';
import { formatDate, getStatusColor, truncateAddress } from '@/lib/utils';
import { ArrowRight, FileText } from 'lucide-react';

interface Request {
  id: string;
  entityType: string;
  value: string;
  name: string;
  status: string;
  requesterEmail: string;
  createdAt: string;
}

interface PendingRequestsProps {
  requests: Request[];
  isLoading?: boolean;
}

export function PendingRequests({ requests, isLoading }: PendingRequestsProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-white">
            Pending Requests
          </h3>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 bg-white/5 rounded-lg animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading font-semibold text-white">
          Pending Requests
        </h3>
        <Link
          href="/requests?status=PENDING"
          className="text-sm text-wisesama-purple hover:text-wisesama-purple-light flex items-center gap-1 transition-colors"
        >
          View all
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-white/40">
          <FileText className="w-8 h-8 mb-2" />
          <p>No pending requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/requests/${request.id}`}
              className="block p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white">{request.name}</p>
                  <p className="text-sm text-white/50 mt-1">
                    {request.entityType === 'ADDRESS'
                      ? truncateAddress(request.value)
                      : request.value}
                  </p>
                </div>
                <span className={`status-badge ${getStatusColor(request.status)}`}>
                  {request.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
                <span>{request.requesterEmail}</span>
                <span>{formatDate(request.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
