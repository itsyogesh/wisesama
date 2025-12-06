'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { whitelistRequestsApi } from '@/lib/api';
import { formatDateTime, getStatusColor, truncateAddress, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ExternalLink,
  Check,
  X,
  Clock,
  Loader2,
  Globe,
  Twitter,
  FileText,
} from 'lucide-react';

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['whitelist-request', params.id],
    queryFn: () => whitelistRequestsApi.getById(params.id as string),
    enabled: !!params.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      status,
      reviewNotes,
      rejectionReason,
    }: {
      status: 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
      reviewNotes?: string;
      rejectionReason?: string;
    }) =>
      whitelistRequestsApi.updateStatus(params.id as string, {
        status,
        reviewNotes,
        rejectionReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist-request', params.id] });
      queryClient.invalidateQueries({ queryKey: ['whitelist-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      toast.success('Request status updated');
      setShowRejectModal(false);
    },
    onError: (error) => {
      toast.error('Failed to update request');
      console.error(error);
    },
  });

  const request = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-wisesama-purple animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-white/60">Request not found</p>
        <Button variant="ghost" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="w-4 h-4" />
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Request Details" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Back button */}
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back to requests
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Entity details */}
            <div className="glass-card p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-heading font-semibold text-white">
                    {request.name}
                  </h2>
                  <p className="text-white/60 mt-1">{request.category}</p>
                </div>
                <span className={cn('status-badge text-sm', getStatusColor(request.status))}>
                  {request.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-white/60">Type</p>
                  <p className="text-white mt-1">{request.entityType}</p>
                </div>
                <div>
                  <p className="text-sm text-white/60">Chain</p>
                  <p className="text-white mt-1">
                    {request.chain?.name || 'All chains'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-white/60">Value</p>
                  <p className="font-mono text-white mt-1 break-all">
                    {request.value}
                  </p>
                </div>
                {request.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-white/60">Description</p>
                    <p className="text-white mt-1">{request.description}</p>
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-white/10">
                {request.website && (
                  <a
                    href={request.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    Website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {request.twitter && (
                  <a
                    href={`https://twitter.com/${request.twitter.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                  >
                    <Twitter className="w-4 h-4" />
                    {request.twitter}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Evidence */}
            {request.evidenceUrls && request.evidenceUrls.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Supporting Evidence
                </h3>
                <div className="space-y-2">
                  {request.evidenceUrls.map((url: string, index: number) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                    >
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0 ml-auto" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Review notes input */}
            {request.status === 'PENDING' || request.status === 'UNDER_REVIEW' ? (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Review Notes
                </h3>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add internal notes about this request..."
                  className="input-field w-full h-32 resize-none"
                />
              </div>
            ) : null}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            {(request.status === 'PENDING' || request.status === 'UNDER_REVIEW') && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Actions
                </h3>
                <div className="space-y-3">
                  {request.status === 'PENDING' && (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() =>
                        updateMutation.mutate({
                          status: 'UNDER_REVIEW',
                          reviewNotes,
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      <Clock className="w-4 h-4" />
                      Mark Under Review
                    </Button>
                  )}
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() =>
                      updateMutation.mutate({
                        status: 'APPROVED',
                        reviewNotes,
                      })
                    }
                    disabled={updateMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => setShowRejectModal(true)}
                    disabled={updateMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Requester info */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Requester
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-white/60">Email</p>
                  <p className="text-white">{request.requesterEmail}</p>
                </div>
                {request.requesterName && (
                  <div>
                    <p className="text-sm text-white/60">Name</p>
                    <p className="text-white">{request.requesterName}</p>
                  </div>
                )}
                {request.requesterOrg && (
                  <div>
                    <p className="text-sm text-white/60">Organization</p>
                    <p className="text-white">{request.requesterOrg}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Timeline
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-white/60">Submitted</p>
                  <p className="text-white">{formatDateTime(request.createdAt)}</p>
                </div>
                {request.reviewedAt && (
                  <div>
                    <p className="text-white/60">Reviewed</p>
                    <p className="text-white">
                      {formatDateTime(request.reviewedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Review result */}
            {request.reviewNotes && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Review Notes
                </h3>
                <p className="text-white/80">{request.reviewNotes}</p>
              </div>
            )}

            {request.rejectionReason && (
              <div className="glass-card p-6 border border-red-500/20">
                <h3 className="text-lg font-heading font-semibold text-red-400 mb-4">
                  Rejection Reason
                </h3>
                <p className="text-white/80">{request.rejectionReason}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-heading font-semibold text-white mb-4">
              Reject Request
            </h3>
            <p className="text-white/60 mb-4">
              Please provide a reason for rejection. This will be sent to the
              requester.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="input-field w-full h-32 resize-none mb-4"
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() =>
                  updateMutation.mutate({
                    status: 'REJECTED',
                    reviewNotes,
                    rejectionReason,
                  })
                }
                disabled={!rejectionReason.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Reject'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
