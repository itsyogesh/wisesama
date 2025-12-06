'use client';

import { Shield, Info } from 'lucide-react';
import type { RiskLevel } from '@wisesama/types';

interface RiskMeterProps {
  score: number | null;
  riskLevel: RiskLevel;
}

const riskConfig: Record<RiskLevel, {
  color: string;
  glowColor: string;
  label: string;
  gradient: string;
}> = {
  SAFE: {
    color: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    label: 'Safe',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  LOW_RISK: {
    color: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    label: 'Low Risk',
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
  UNKNOWN: {
    color: '#6B7280',
    glowColor: 'rgba(107, 114, 128, 0.4)',
    label: 'Unknown',
    gradient: 'from-gray-500/20 to-gray-500/5',
  },
  CAUTION: {
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    label: 'Caution',
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
  FRAUD: {
    color: '#EF4444',
    glowColor: 'rgba(239, 68, 68, 0.4)',
    label: 'High Risk',
    gradient: 'from-red-500/20 to-red-500/5',
  },
};

// Segments for the meter
const segments = [
  { label: 'Safe', start: 0, end: 20, color: '#10B981' },
  { label: 'Low', start: 20, end: 40, color: '#3B82F6' },
  { label: 'Unknown', start: 40, end: 60, color: '#6B7280' },
  { label: 'Caution', start: 60, end: 80, color: '#F59E0B' },
  { label: 'Fraud', start: 80, end: 100, color: '#EF4444' },
];

export function RiskMeter({ score, riskLevel }: RiskMeterProps) {
  const displayScore = score ?? 50;
  const config = riskConfig[riskLevel];
  const percentage = Math.min(100, Math.max(0, displayScore));

  return (
    <div className="relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Shield className="h-4 w-4" style={{ color: config.color }} />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-300">Risk Assessment</span>
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3 text-gray-600" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">Wisesama Analysis</span>
              </div>
            </div>
          </div>

          {/* Score Display */}
          <div className="text-right">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: config.color }}
              >
                {config.label}
              </span>
            </div>
            {score !== null && (
              <span className="text-sm text-gray-500">
                Score: <span className="font-mono" style={{ color: config.color }}>{score}%</span>
              </span>
            )}
          </div>
        </div>

        {/* Segmented Meter */}
        <div className="space-y-2">
          <div className="relative h-3 rounded-full bg-zinc-900/80 overflow-hidden flex">
            {segments.map((segment, idx) => (
              <div
                key={segment.label}
                className="relative h-full transition-all duration-300"
                style={{
                  width: '20%',
                  backgroundColor: percentage >= segment.start
                    ? `${segment.color}${percentage >= segment.end ? '40' : '25'}`
                    : 'transparent',
                }}
              >
                {/* Segment divider */}
                {idx < segments.length - 1 && (
                  <div className="absolute right-0 top-0 bottom-0 w-px bg-zinc-800" />
                )}
              </div>
            ))}

            {/* Animated glow under indicator */}
            <div
              className="absolute inset-y-0 left-0 transition-all duration-700 ease-out"
              style={{
                width: `${percentage}%`,
                background: `linear-gradient(90deg, transparent 60%, ${config.glowColor} 100%)`,
              }}
            />

            {/* Indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
              style={{ left: `calc(${percentage}% - 6px)` }}
            >
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
                style={{
                  backgroundColor: config.color,
                  boxShadow: `0 0 12px ${config.glowColor}, 0 0 4px ${config.color}`,
                }}
              />
            </div>
          </div>

          {/* Segment Labels */}
          <div className="flex justify-between px-1">
            {segments.map((segment) => (
              <span
                key={segment.label}
                className="text-[10px] font-medium uppercase tracking-wider transition-colors"
                style={{
                  color: percentage >= segment.start && percentage < segment.end + 1
                    ? segment.color
                    : '#52525b'
                }}
              >
                {segment.label}
              </span>
            ))}
          </div>
        </div>
      </div>
  );
}
