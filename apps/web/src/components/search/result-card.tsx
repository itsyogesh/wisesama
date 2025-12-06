'use client';

import { Flag, Clock, CheckCircle, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { CheckResponse } from '@wisesama/types';
import { RiskMeter } from './risk-meter';
import { RiskBadge } from './risk-badge';
import { AssessmentHeader } from './assessment-header';
import { EntityDetailsCard } from './entity-details-card';
import { MLAnalysisSection } from './ml-analysis-section';
import { StatsSection } from './stats-section';
import { ShareSection } from './share-section';

interface ResultCardProps {
  result: CheckResponse;
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function ResultCard({ result }: ResultCardProps) {
  const {
    entity,
    entityType,
    chain,
    assessment,
    stats,
    mlAnalysis,
    transactionSummary,
    links,
    identity,
  } = result;

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(entity);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine if we should show identity name as title
  const hasVerifiedIdentity = entityType === 'ADDRESS' && identity?.hasIdentity && identity?.displayName;
  const displayTitle = hasVerifiedIdentity ? identity.displayName : entity;
  const showAddressSubtitle = hasVerifiedIdentity;

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Tags Row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-wisesama-purple/20 text-wisesama-purple-light border border-wisesama-purple/30 uppercase tracking-wide">
                  {entityType}
                </span>
                {chain && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-zinc-800 text-gray-300 border border-zinc-700 capitalize">
                    {chain}
                  </span>
                )}
                {hasVerifiedIdentity && identity?.isVerified && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle className="h-3 w-3" />
                    Verified Identity
                  </span>
                )}
              </div>

              {/* Title */}
              <h2 className="font-heading text-2xl font-bold text-white leading-tight">
                {displayTitle}
              </h2>

              {/* Address subtitle when showing identity name */}
              {showAddressSubtitle && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-sm text-gray-400 font-mono bg-zinc-800/50 px-2 py-1 rounded">
                    {truncateAddress(entity, 10)}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors group"
                    title="Copy full address"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-500 group-hover:text-gray-300" />
                    )}
                  </button>
                </div>
              )}

              {/* Full entity for non-identity addresses */}
              {!showAddressSubtitle && entityType === 'ADDRESS' && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-400 font-mono break-all">{entity}</p>
                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors group flex-shrink-0"
                    title="Copy address"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-gray-500 group-hover:text-gray-300" />
                    )}
                  </button>
                </div>
              )}
            </div>
            <RiskBadge riskLevel={assessment.riskLevel} size="lg" />
          </div>
        </div>

        {/* Risk Meter */}
        <div className="p-6 border-b border-zinc-800">
          <RiskMeter score={assessment.riskScore} riskLevel={assessment.riskLevel} />
        </div>

        {/* Assessment Header */}
        <div className="p-6 border-b border-zinc-800">
          <AssessmentHeader
            riskLevel={assessment.riskLevel}
            timestamp={stats.lastSearched}
          />
        </div>

        {/* Entity Details */}
        <div className="p-6">
          <EntityDetailsCard result={result} />
        </div>
      </div>

      {/* ML Analysis Section (for addresses only) */}
      {entityType === 'ADDRESS' && (
        <MLAnalysisSection
          mlAnalysis={mlAnalysis}
          transactionSummary={transactionSummary}
          blockExplorerUrl={links?.blockExplorer}
        />
      )}

      {/* Stats Section */}
      <StatsSection stats={stats} />

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Link
          href={`/report?entity=${encodeURIComponent(entity)}&type=${entityType}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-600/80 text-white font-medium hover:bg-red-600 transition-colors"
        >
          <Flag className="h-4 w-4" />
          Report This Fraud
        </Link>
        <button
          disabled
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-800 text-gray-400 font-medium cursor-not-allowed relative"
        >
          <Clock className="h-4 w-4" />
          Track this {entityType === 'ADDRESS' ? 'Wallet' : 'Entity'}
          <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-600 text-white">
            Coming Soon
          </span>
        </button>
      </div>

      {/* Share Section */}
      <ShareSection entity={entity} entityType={entityType} />
    </div>
  );
}
