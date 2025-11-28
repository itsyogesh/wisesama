import { CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { RiskLevel } from '@wisesama/types';

interface AssessmentHeaderProps {
  riskLevel: RiskLevel;
  timestamp?: Date | null;
}

const assessmentConfig: Record<RiskLevel, {
  label: string;
  icon: typeof CheckCircle;
  color: string;
  bgColor: string;
  description: string;
}> = {
  SAFE: {
    label: 'Safe',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    description: 'This entity has been verified as safe. You can safely interact with it.',
  },
  LOW_RISK: {
    label: 'Low Risk',
    icon: CheckCircle,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'This entity shows low risk indicators. Exercise normal caution when interacting.',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: HelpCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    description: 'We don\'t have enough data about this entity. Please verify independently before proceeding.',
  },
  CAUTION: {
    label: 'Caution',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    description: 'This entity shows some warning signs. Please verify carefully before any transaction.',
  },
  FRAUD: {
    label: 'FRAUD',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    description: 'This has been assessed as fraud!! Please do not transact or interact with this entity.',
  },
};

function formatTimestamp(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    timeZoneName: 'short',
  });
}

export function AssessmentHeader({ riskLevel, timestamp }: AssessmentHeaderProps) {
  const config = assessmentConfig[riskLevel];
  const Icon = config.icon;

  return (
    <div className={`p-6 rounded-lg ${config.bgColor}`}>
      <div className="space-y-3">
        {/* Label */}
        <p className="text-xs text-gray-400 uppercase tracking-wider">Assessment Result</p>

        {/* Result with icon */}
        <div className="flex items-center gap-3">
          <Icon className={`h-8 w-8 ${config.color}`} />
          <h2 className={`text-3xl font-bold ${config.color}`}>
            {config.label}
          </h2>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-sm leading-relaxed">
          {config.description}
        </p>

        {/* Timestamp */}
        {timestamp && (
          <p className="text-xs text-gray-500 mt-2">
            as on {formatTimestamp(new Date(timestamp))}
          </p>
        )}
      </div>
    </div>
  );
}
