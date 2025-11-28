import { Info, ExternalLink, AlertTriangle } from 'lucide-react';
import type { MLAnalysisResult, TransactionSummary } from '@wisesama/types';

interface MLAnalysisSectionProps {
  mlAnalysis?: MLAnalysisResult;
  transactionSummary?: TransactionSummary;
  blockExplorerUrl?: string;
}

export function MLAnalysisSection({ mlAnalysis, transactionSummary, blockExplorerUrl }: MLAnalysisSectionProps) {
  if (!mlAnalysis?.available) {
    return null;
  }

  const riskScore = mlAnalysis.riskScore ?? 50;
  const riskColor = riskScore < 30 ? '#83FF8F' : riskScore < 70 ? '#FFA500' : '#FF3939';

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-300">
            Machine Learning Analysis of Wallet Transactions
          </h3>
          <Info className="h-4 w-4 text-gray-500" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Probability Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Probability of fraud is</span>
            <span className="text-lg font-semibold" style={{ color: riskColor }}>
              {riskScore}%
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{
                width: `${riskScore}%`,
                backgroundColor: riskColor,
                boxShadow: `0 0 8px ${riskColor}40`,
              }}
            />
          </div>
        </div>

        {/* Transaction Data Grid */}
        {transactionSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-gray-500 mb-1">Total Transactions</p>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-white">
                  {transactionSummary.totalTransactions}
                </span>
                {blockExplorerUrl && (
                  <a
                    href={blockExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-600/80 text-white hover:bg-purple-600 transition-colors"
                  >
                    Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-gray-500 mb-1">Total Received</p>
              <span className="text-xl font-bold text-green-400">
                {transactionSummary.totalReceived}
              </span>
            </div>

            <div className="p-4 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-gray-500 mb-1">Total Sent</p>
              <span className="text-xl font-bold text-red-400">
                {transactionSummary.totalSent}
              </span>
            </div>
          </div>
        )}

        {/* Current Balance */}
        {transactionSummary && (
          <div className="p-4 rounded-lg bg-zinc-800/50">
            <p className="text-xs text-gray-500 mb-1">Current Balance</p>
            <span className="text-2xl font-bold text-purple-400">
              {transactionSummary.currentBalance}
            </span>
          </div>
        )}

        {/* Top Features */}
        {mlAnalysis.topFeatures && mlAnalysis.topFeatures.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-400 flex items-center gap-2">
              Top Features influencing ML Analysis
              <Info className="h-3.5 w-3.5 text-gray-500" />
            </h4>
            <div className="flex flex-wrap gap-2">
              {mlAnalysis.topFeatures.map((feature, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-gray-300"
                >
                  {feature.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
          <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-orange-400">ML Analysis Limitations</p>
            <p className="text-xs text-gray-400">
              This analysis is based on on-chain transaction patterns and may not capture all fraud indicators.
              Always conduct your own research before making any transactions.
              Confidence: {mlAnalysis.confidence ? `${Math.round(mlAnalysis.confidence * 100)}%` : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
