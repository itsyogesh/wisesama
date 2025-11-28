import { AlertTriangle, Flag, Clock } from 'lucide-react';
import Link from 'next/link';
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

export function ResultCard({ result }: ResultCardProps) {
  const {
    entity,
    entityType,
    chain,
    assessment,
    stats,
    lookAlike,
    mlAnalysis,
    transactionSummary,
    links,
  } = result;

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-600/80 text-white">
                  {entityType}
                </span>
                {chain && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-700 text-gray-300 capitalize">
                    {chain}
                  </span>
                )}
              </div>
              <h2 className="font-heading text-xl font-semibold break-all text-white">{entity}</h2>
            </div>
            <RiskBadge riskLevel={assessment.riskLevel} />
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

      {/* Look-alike Warning */}
      {lookAlike?.isLookAlike && (
        <div className="rounded-xl bg-orange-500/10 border border-orange-500/40 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading font-semibold text-orange-400 mb-1">
                Possible Impersonation Detected
              </h3>
              <p className="text-gray-300">{lookAlike.warning}</p>
              {lookAlike.similarity && (
                <p className="text-sm text-gray-400 mt-2">
                  Similarity: {Math.round(lookAlike.similarity * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
