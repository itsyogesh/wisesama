import type { RiskLevel } from '@wisesama/types';

interface RiskMeterProps {
  score: number | null;
  riskLevel: RiskLevel;
}

const riskColors: Record<RiskLevel, string> = {
  SAFE: '#83FF8F',
  UNKNOWN: '#888888',
  CAUTION: '#FFA500',
  FRAUD: '#FF3939',
};

export function RiskMeter({ score, riskLevel }: RiskMeterProps) {
  const displayScore = score ?? 50;
  const color = riskColors[riskLevel];
  const percentage = Math.min(100, Math.max(0, displayScore));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Risk Score</span>
        <span className="text-2xl font-bold" style={{ color }}>
          {score !== null ? score : '—'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-wisesama-dark-secondary overflow-hidden">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, #83FF8F 0%, #FFA500 50%, #FF3939 100%)',
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

        {/* Indicator */}
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
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Safe</span>
        <span>Unknown</span>
        <span>Caution</span>
        <span>Fraud</span>
      </div>
    </div>
  );
}
