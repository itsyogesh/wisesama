'use client';

import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-wisesama-purple',
}: StatsCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/60">{title}</p>
          <p className="text-3xl font-heading font-bold text-white mt-2">
            {value}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {isPositive && (
                <TrendingUp className="w-4 h-4 text-green-400" />
              )}
              {isNegative && (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span
                className={cn(
                  'text-sm',
                  isPositive && 'text-green-400',
                  isNegative && 'text-red-400',
                  !isPositive && !isNegative && 'text-white/60'
                )}
              >
                {isPositive && '+'}
                {change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-white/40">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            'bg-wisesama-purple/10'
          )}
        >
          <Icon className={cn('w-6 h-6', iconColor)} />
        </div>
      </div>
    </div>
  );
}
