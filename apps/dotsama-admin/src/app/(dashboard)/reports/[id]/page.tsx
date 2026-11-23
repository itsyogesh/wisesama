'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { reportsApi } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertTriangle,
  Shield,
  GitPullRequest,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [verifyOptions, setVerifyOptions] = useState({
    addToBlacklist: true,
    contributeToUpstream: true,
    threatName: '',
    notes: '',
  });
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsApi.getById(id),
  });

  const verifyMutation = useMutation({
    mutationFn: () => reportsApi.verify(id, verifyOptions),
    onSuccess: (data) => {
      toast.success('Report verified successfully');
      if (data.contribution?.prUrl) {
        toast.success(`GitHub PR created: ${data.contribution.prUrl}`);
      }
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      router.push('/reports');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to verify report');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => reportsApi.reject(id, rejectReason),
    onSuccess: () => {
      toast.success('Report rejected');
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      router.push('/reports');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reject report');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wisesama-purple" />
      </div>
    );
  }

  if (error || !data?.report) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-white/60">Report not found</p>
        <Button variant="outline" onClick={() => router.push('/reports')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Button>
      </div>
    );
  }

  const report = data.report;
  const relatedReports = data.relatedReports || [];
  const isPending = report.status === 'pending';

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Report Details"
        description={`Review report #${id.slice(0, 8)}...`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/reports')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reports
        </button>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Entity card */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Reported Entity
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/60">Value</p>
                  <p className="font-mono text-white break-all mt-1">
                    {report.reportedValue}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-white/60">Type</p>
                    <span className="status-badge bg-wisesama-purple/20 text-wisesama-purple-light mt-1">
                      {report.entityType}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Threat Category</p>
                    <span className="status-badge bg-red-500/20 text-red-400 mt-1">
                      {report.threatCategory}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {report.description && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Description
                </h3>
                <p className="text-white/80 whitespace-pre-wrap">
                  {report.description}
                </p>
              </div>
            )}

            {/* Evidence */}
            {report.evidenceUrls && report.evidenceUrls.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Evidence
                </h3>
                <ul className="space-y-2">
                  {report.evidenceUrls.map((url: string, index: number) => (
                    <li key={index}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-wisesama-purple hover:text-wisesama-purple-light transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Related reports */}
            {relatedReports.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Related Reports ({relatedReports.length})
                </h3>
                <div className="space-y-2">
                  {relatedReports.map((r: { id: string; threatCategory: string; status: string; createdAt: string }) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                    >
                      <div>
                        <span className="status-badge bg-red-500/20 text-red-400">
                          {r.threatCategory}
                        </span>
                        <span className="text-white/40 text-sm ml-2">
                          {formatDateTime(r.createdAt)}
                        </span>
                      </div>
                      <span className={cn(
                        'status-badge',
                        r.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                        r.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      )}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status card */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Status
              </h3>
              <span className={cn(
                'status-badge text-lg',
                report.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                report.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              )}>
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </span>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Reported</span>
                  <span className="text-white">{formatDateTime(report.createdAt)}</span>
                </div>
                {report.reviewedAt && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Reviewed</span>
                    <span className="text-white">{formatDateTime(report.reviewedAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reporter info */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-heading font-semibold text-white mb-4">
                Reporter
              </h3>
              <div className="space-y-2 text-sm">
                {report.user?.email ? (
                  <p className="text-white">{report.user.email}</p>
                ) : report.reporterEmail ? (
                  <p className="text-white">{report.reporterEmail}</p>
                ) : (
                  <p className="text-white/40">Anonymous</p>
                )}
                {report.reporterName && (
                  <p className="text-white/60">{report.reporterName}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            {isPending && (
              <div className="glass-card p-6">
                <h3 className="text-lg font-heading font-semibold text-white mb-4">
                  Actions
                </h3>
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={() => setShowVerifyModal(true)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Verify Report
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={() => setShowRejectModal(true)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject Report
                  </Button>
                </div>
              </div>
            )}

            {/* Entity in blacklist? */}
            {report.entity && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-heading font-semibold text-white">
                    Already Blacklisted
                  </h3>
                </div>
                <p className="text-sm text-white/60">
                  This entity is already in the blacklist with risk level:{' '}
                  <span className="text-red-400 font-medium">{report.entity.riskLevel}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verify Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-heading font-semibold text-white mb-4">
              Verify Report
            </h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={verifyOptions.addToBlacklist}
                  onChange={(e) =>
                    setVerifyOptions({ ...verifyOptions, addToBlacklist: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-white/20 bg-white/10"
                />
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-wisesama-purple" />
                  <span className="text-white">Add to blacklist</span>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={verifyOptions.contributeToUpstream}
                  onChange={(e) =>
                    setVerifyOptions({ ...verifyOptions, contributeToUpstream: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-white/20 bg-white/10"
                />
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-wisesama-purple" />
                  <span className="text-white">Create GitHub PR</span>
                </div>
              </label>
              <div>
                <label className="text-sm text-white/60">Threat Name (optional)</label>
                <input
                  type="text"
                  value={verifyOptions.threatName}
                  onChange={(e) =>
                    setVerifyOptions({ ...verifyOptions, threatName: e.target.value })
                  }
                  placeholder="e.g., Polkadot Airdrop Scam"
                  className="input-field w-full mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-white/60">Notes (optional)</label>
                <textarea
                  value={verifyOptions.notes}
                  onChange={(e) =>
                    setVerifyOptions({ ...verifyOptions, notes: e.target.value })
                  }
                  placeholder="Internal notes..."
                  className="input-field w-full mt-1 h-20 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowVerifyModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-heading font-semibold text-white mb-4">
              Reject Report
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/60">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this report is being rejected..."
                  className="input-field w-full mt-1 h-24 resize-none"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRejectModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => rejectMutation.mutate()}
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
