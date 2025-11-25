import { CheckCircle, AlertTriangle, XCircle, HelpCircle, ShieldCheck } from 'lucide-react';
import type { RiskLevel } from '@wisesama/types';

interface RiskBadgeProps {
  riskLevel: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
}

const config: Record<
  RiskLevel,
  {
    icon: typeof CheckCircle;
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  }
> = {
  SAFE: {
    icon: CheckCircle,
    label: 'Safe',
    bgColor: 'bg-wisesama-status-safe/10',
    textColor: 'text-wisesama-status-safe',
    borderColor: 'border-wisesama-status-safe/40',
  },
  LOW_RISK: {
    icon: ShieldCheck,
    label: 'Low Risk',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
    borderColor: 'border-blue-500/40',
  },
  UNKNOWN: {
    icon: HelpCircle,
    label: 'Unknown',
    bgColor: 'bg-muted/10',
    textColor: 'text-muted-foreground',
    borderColor: 'border-muted',
  },
  CAUTION: {
    icon: AlertTriangle,
    label: 'Caution',
    bgColor: 'bg-wisesama-status-caution/10',
    textColor: 'text-wisesama-status-caution',
    borderColor: 'border-wisesama-status-caution/40',
  },
  FRAUD: {
    icon: XCircle,
    label: 'Fraud',
    bgColor: 'bg-wisesama-status-fraud/10',
    textColor: 'text-wisesama-status-fraud',
    borderColor: 'border-wisesama-status-fraud/40',
  },
};

const sizes = {
  sm: {
    padding: 'px-2 py-1',
    text: 'text-xs',
    icon: 'h-3 w-3',
  },
  md: {
    padding: 'px-3 py-1.5',
    text: 'text-sm',
    icon: 'h-4 w-4',
  },
  lg: {
    padding: 'px-4 py-2',
    text: 'text-base',
    icon: 'h-5 w-5',
  },
};

export function RiskBadge({ riskLevel, size = 'md' }: RiskBadgeProps) {
  const { icon: Icon, label, bgColor, textColor, borderColor } = config[riskLevel];
  const sizeConfig = sizes[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border ${bgColor} ${borderColor} ${sizeConfig.padding}`}
    >
      <Icon className={`${sizeConfig.icon} ${textColor}`} />
      <span className={`font-medium ${sizeConfig.text} ${textColor}`}>{label}</span>
    </div>
  );
}
