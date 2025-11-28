import { Info } from 'lucide-react';
import type { RiskLevel } from '@wisesama/types';

interface RiskMeterProps {
  score: number | null;
  riskLevel: RiskLevel;
}

const riskColors: Record<RiskLevel, string> = {
  SAFE: '#83FF8F',
  LOW_RISK: '#3B82F6',
  UNKNOWN: '#888888',
  CAUTION: '#FFA500',
  FRAUD: '#FF3939',
};

const riskLabels: Record<RiskLevel, string> = {
  SAFE: 'Safe',
  LOW_RISK: 'Low Risk',
  UNKNOWN: 'Unknown',
  CAUTION: 'Caution',
  FRAUD: 'High Risk',
};

export function RiskMeter({ score, riskLevel }: RiskMeterProps) {
  const displayScore = score ?? 50;
  const color = riskColors[riskLevel];
  const label = riskLabels[riskLevel];
  const percentage = Math.min(100, Math.max(0, displayScore));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-400">Wisesama Risk Meter</span>
          <Info className="h-4 w-4 text-gray-500" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold" style={{ color }}>
            {label}
          </span>
          {score !== null && (
            <span className="text-lg font-semibold" style={{ color }}>
              ({score}%)
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #83FF8F 0%, #888888 30%, #FFA500 60%, #FF3939 100%)',
            opacity: 0.2,
          }}
        />

        {/* Active fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`,
          }}
        />

        {/* Indicator dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 transition-all duration-500"
          style={{
            left: `calc(${percentage}% - 8px)`,
            borderColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>Safe</span>
        <span>Unknown</span>
        <span>Caution</span>
        <span>Fraud</span>
      </div>
    </div>
  );
}
