'use client';

import { Shield, Scan, Database, Brain, BarChart3 } from 'lucide-react';

/**
 * Shimmer effect component for skeleton loading
 */
function Shimmer({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-zinc-800/60 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
    </div>
  );
}

/**
 * Scanning indicator with animated dots
 */
function ScanningIndicator() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-wisesama-purple/10 border border-wisesama-purple/30">
      <div className="relative">
        <Scan className="h-5 w-5 text-wisesama-purple-light animate-pulse" />
        <div className="absolute inset-0 animate-ping">
          <Scan className="h-5 w-5 text-wisesama-purple-light opacity-40" />
        </div>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-wisesama-purple-light">Analyzing entity</p>
        <p className="text-xs text-gray-500">Running security checks<span className="inline-flex ml-1"><span className="animate-[bounce_1s_infinite_0ms]">.</span><span className="animate-[bounce_1s_infinite_200ms]">.</span><span className="animate-[bounce_1s_infinite_400ms]">.</span></span></p>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1.5 h-4 rounded-full bg-wisesama-purple/40"
            style={{
              animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
              transform: `scaleY(${0.3 + Math.random() * 0.7})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Progress step indicator
 */
function ProgressSteps() {
  const steps = [
    { icon: Database, label: 'Blacklist Check', delay: '0s' },
    { icon: Shield, label: 'Risk Assessment', delay: '0.5s' },
    { icon: Brain, label: 'ML Analysis', delay: '1s' },
    { icon: BarChart3, label: 'Stats', delay: '1.5s' },
  ];

  return (
    <div className="flex items-center justify-between px-2">
      {steps.map((step, idx) => (
        <div key={step.label} className="flex items-center">
          <div
            className="flex flex-col items-center gap-1.5"
            style={{ animation: `fadeIn 0.5s ease-out ${step.delay} both` }}
          >
            <div className="relative">
              <div className="p-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50">
                <step.icon className="h-4 w-4 text-gray-500" />
              </div>
              {idx < 3 && (
                <div
                  className="absolute top-1/2 left-full w-8 h-px bg-gradient-to-r from-zinc-700 to-transparent"
                  style={{ transform: 'translateY(-50%)' }}
                />
              )}
            </div>
            <span className="text-[10px] text-gray-600 uppercase tracking-wider whitespace-nowrap">
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && <div className="w-12 md:w-16" />}
        </div>
      ))}
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div className="space-y-6">
      {/* Scanning Status */}
      <ScanningIndicator />

      {/* Main Card */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {/* Header - matches result-card header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              {/* Tags */}
              <div className="flex gap-2">
                <Shimmer className="h-6 w-20 rounded-md" />
                <Shimmer className="h-6 w-16 rounded-md" />
              </div>
              {/* Title */}
              <Shimmer className="h-8 w-72 rounded-lg" />
              {/* Subtitle */}
              <Shimmer className="h-5 w-48 rounded" />
            </div>
            {/* Risk Badge */}
            <Shimmer className="h-10 w-28 rounded-full" />
          </div>
        </div>

        {/* Risk Meter Section */}
        <div className="p-6 border-b border-zinc-800">
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Shimmer className="h-8 w-8 rounded-lg" />
                <div className="space-y-1">
                  <Shimmer className="h-4 w-28 rounded" />
                  <Shimmer className="h-3 w-24 rounded" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Shimmer className="h-7 w-24 rounded ml-auto" />
                <Shimmer className="h-4 w-16 rounded ml-auto" />
              </div>
            </div>
            {/* Meter Bar */}
            <Shimmer className="h-3 w-full rounded-full" />
            {/* Labels */}
            <div className="flex justify-between px-1">
              {['Safe', 'Low', 'Unknown', 'Caution', 'Fraud'].map((label) => (
                <span key={label} className="text-[10px] text-zinc-700 uppercase tracking-wider">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Assessment Result Section */}
        <div className="p-6 border-b border-zinc-800">
          <div className="relative rounded-xl bg-zinc-800/30 border border-zinc-700/30 p-8 overflow-hidden">
            <div className="flex flex-col items-center text-center space-y-4">
              <Shimmer className="h-3 w-32 rounded" />
              <div className="flex items-center gap-3">
                <Shimmer className="h-12 w-12 rounded-xl" />
                <Shimmer className="h-10 w-32 rounded-lg" />
              </div>
              <Shimmer className="h-4 w-80 max-w-full rounded" />
              <Shimmer className="h-3 w-48 rounded" />
            </div>
          </div>
        </div>

        {/* Entity Details Section */}
        <div className="p-6 space-y-4">
          {/* Type Row */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600 uppercase tracking-wider w-12">Type</span>
            <Shimmer className="h-8 w-32 rounded-lg" />
          </div>

          {/* Detail Rows */}
          {[
            'Blacklist Search',
            'Whitelist Search',
            'Look-alike Assessment',
            'Linked Identities',
          ].map((label, i) => (
            <div
              key={label}
              className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/30"
              style={{ animation: `fadeIn 0.4s ease-out ${0.2 + i * 0.1}s both` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shimmer className="h-4 w-4 rounded" />
                  <div className="space-y-1">
                    <Shimmer className="h-4 w-32 rounded" />
                    <Shimmer className="h-3 w-48 rounded" />
                  </div>
                </div>
                <Shimmer className="h-6 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="py-4">
        <ProgressSteps />
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-3 gap-3">
        {['Reports', 'Searches', 'Last Check'].map((label, i) => (
          <div
            key={label}
            className="relative p-4 rounded-xl bg-zinc-800/30 border border-zinc-800/50 overflow-hidden"
            style={{ animation: `fadeIn 0.4s ease-out ${0.6 + i * 0.1}s both` }}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Shimmer className="h-4 w-4 rounded" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</span>
              </div>
              <Shimmer className="h-8 w-16 rounded" />
              <Shimmer className="h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Shimmer className="flex-1 h-12 rounded-lg" />
        <Shimmer className="flex-1 h-12 rounded-lg" />
      </div>

      {/* Share Section */}
      <div className="flex items-center justify-center gap-4 py-4">
        <Shimmer className="h-4 w-24 rounded" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Shimmer key={i} className="h-9 w-9 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Custom Keyframes Style */}
      <style jsx global>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
