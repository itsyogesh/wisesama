import { Info, ExternalLink, AlertTriangle, Brain, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import type { MLAnalysisResult, TransactionSummary } from '@wisesama/types';

interface MLFeature {
  name: string;
  importance: number;
  value: string | number;
  score?: number;
}

interface MLAnalysisSectionProps {
  mlAnalysis?: MLAnalysisResult & { topFeatures?: MLFeature[] };
  transactionSummary?: TransactionSummary;
  blockExplorerUrl?: string;
}

export function MLAnalysisSection({ mlAnalysis, transactionSummary, blockExplorerUrl }: MLAnalysisSectionProps) {
  if (!mlAnalysis?.available) {
    return null;
  }

  const riskScore = mlAnalysis.riskScore ?? 50;
  const riskColor = riskScore < 30 ? '#10B981' : riskScore < 70 ? '#F59E0B' : '#EF4444';
  const riskGradient = riskScore < 30
    ? 'from-emerald-500/10 to-transparent'
    : riskScore < 70
      ? 'from-amber-500/10 to-transparent'
      : 'from-red-500/10 to-transparent';

  return (
    <div className={`rounded-xl bg-gradient-to-br ${riskGradient} border border-zinc-800 overflow-hidden`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800/50">
            <Brain className="h-5 w-5 text-wisesama-purple-light" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              ML Transaction Analysis
            </h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Wallet Behavior Pattern</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Probability Display */}
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fraud Probability</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tabular-nums" style={{ color: riskColor }}>
                  {riskScore}
                </span>
                <span className="text-lg font-medium" style={{ color: riskColor }}>%</span>
              </div>
            </div>
            {mlAnalysis.confidence && (
              <div className="text-right">
                <p className="text-xs text-gray-600">Confidence</p>
                <p className="text-sm font-medium text-gray-400">
                  {Math.round(mlAnalysis.confidence * 100)}%
                </p>
              </div>
            )}
          </div>

          {/* Risk Bar */}
          <div className="relative h-2.5 rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${riskScore}%`,
                backgroundColor: riskColor,
                boxShadow: `0 0 12px ${riskColor}40`,
              }}
            />
            {/* Threshold markers */}
            <div className="absolute top-0 bottom-0 left-[30%] w-px bg-zinc-600/50" />
            <div className="absolute top-0 bottom-0 left-[70%] w-px bg-zinc-600/50" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 px-0.5">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>

        {/* Transaction Summary Grid */}
        {transactionSummary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-3.5 w-3.5 text-gray-500" />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Transactions</p>
              </div>
              <p className="text-xl font-bold text-white tabular-nums">
                {transactionSummary.totalTransactions}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Received</p>
              </div>
              <p className="text-lg font-bold text-emerald-400 tabular-nums truncate" title={transactionSummary.totalReceived}>
                {transactionSummary.totalReceived}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-red-500" />
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Sent</p>
              </div>
              <p className="text-lg font-bold text-red-400 tabular-nums truncate" title={transactionSummary.totalSent}>
                {transactionSummary.totalSent}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold text-wisesama-purple-light">$</span>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Balance</p>
              </div>
              <p className="text-lg font-bold text-wisesama-purple-light tabular-nums truncate" title={transactionSummary.currentBalance}>
                {transactionSummary.currentBalance}
              </p>
            </div>
          </div>
        )}

        {/* Block Explorer Link */}
        {blockExplorerUrl && (
          <a
            href={blockExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-wisesama-purple/20 text-wisesama-purple-light border border-wisesama-purple/30 hover:bg-wisesama-purple/30 transition-colors"
          >
            View on Block Explorer
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Top Features */}
        {mlAnalysis.topFeatures && mlAnalysis.topFeatures.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
              Key Indicators
              <Info className="h-3 w-3" />
            </h4>
            <div className="flex flex-wrap gap-2">
              {mlAnalysis.topFeatures.map((feature, index) => {
                const isPositive = (feature.score ?? 0) > 0;
                const isTrust = (feature.score ?? 0) < 0;
                
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      isPositive
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : isTrust
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800/60 border-zinc-700/30 text-gray-300'
                    }`}
                  >
                    <span>{feature.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      isPositive ? 'bg-red-500/20' : isTrust ? 'bg-emerald-500/20' : 'bg-zinc-700'
                    }`}>
                      {feature.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-amber-400">Analysis Disclaimer</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Based on on-chain patterns only. Always conduct independent research before transactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
