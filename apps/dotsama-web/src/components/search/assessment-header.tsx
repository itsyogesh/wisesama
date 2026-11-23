import { CheckCircle, XCircle, AlertTriangle, HelpCircle, ShieldCheck, Clock } from 'lucide-react';
import type { RiskLevel } from '@wisesama/types';

interface AssessmentHeaderProps {
  riskLevel: RiskLevel;
  timestamp?: Date | null;
}

const assessmentConfig: Record<RiskLevel, {
  label: string;
  icon: typeof CheckCircle;
  color: string;
  bgGradient: string;
  borderColor: string;
  glowColor: string;
  description: string;
}> = {
  SAFE: {
    label: 'Safe',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    borderColor: 'border-emerald-500/20',
    glowColor: 'shadow-emerald-500/10',
    description: 'This entity has been verified as safe. You can safely interact with it.',
  },
  LOW_RISK: {
    label: 'Low Risk',
    icon: CheckCircle,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    borderColor: 'border-blue-500/20',
    glowColor: 'shadow-blue-500/10',
    description: 'This entity shows low risk indicators. Exercise normal caution when interacting.',
  },
  UNKNOWN: {
    label: 'Unknown',
    icon: HelpCircle,
    color: 'text-gray-400',
    bgGradient: 'from-gray-500/10 via-gray-500/5 to-transparent',
    borderColor: 'border-gray-500/20',
    glowColor: 'shadow-gray-500/10',
    description: 'We don\'t have enough data about this entity. Please verify independently before proceeding.',
  },
  CAUTION: {
    label: 'Caution',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    borderColor: 'border-amber-500/20',
    glowColor: 'shadow-amber-500/10',
    description: 'This entity shows some warning signs. Please verify carefully before any transaction.',
  },
  FRAUD: {
    label: 'FRAUD',
    icon: XCircle,
    color: 'text-red-400',
    bgGradient: 'from-red-500/15 via-red-500/5 to-transparent',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-red-500/20',
    description: 'This has been assessed as fraud. Do not transact or interact with this entity.',
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
    <div className={`relative rounded-xl bg-gradient-to-br ${config.bgGradient} border ${config.borderColor} p-6 overflow-hidden shadow-lg ${config.glowColor}`}>
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03]">
        <Icon className="w-full h-full" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative space-y-4">
        {/* Label */}
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium px-2">
            Assessment Result
          </p>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        </div>

        {/* Result with icon */}
        <div className="flex items-center justify-center gap-4">
          <div className={`p-3 rounded-xl bg-zinc-900/50 border ${config.borderColor}`}>
            <Icon className={`h-8 w-8 ${config.color}`} />
          </div>
          <h2 className={`text-4xl font-heading font-bold tracking-tight ${config.color}`}>
            {config.label}
          </h2>
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm leading-relaxed text-center max-w-md mx-auto">
          {config.description}
        </p>

        {/* Timestamp */}
        {timestamp && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Clock className="h-3 w-3 text-gray-600" />
            <p className="text-xs text-gray-600">
              {formatTimestamp(new Date(timestamp))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
