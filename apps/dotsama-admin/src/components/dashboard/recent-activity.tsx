'use client';

import { formatDateTime } from '@/lib/utils';
import {
  Shield,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  userEmail?: string;
  createdAt: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const activityIcons: Record<string, typeof Shield> = {
  WHITELIST_CREATED: Shield,
  WHITELIST_UPDATED: Shield,
  WHITELIST_DELETED: Shield,
  REQUEST_SUBMITTED: FileText,
  REQUEST_APPROVED: CheckCircle,
  REQUEST_REJECTED: XCircle,
  REPORT_VERIFIED: CheckCircle,
  REPORT_REJECTED: XCircle,
  SYNC_COMPLETED: Activity,
  ADMIN_LOGIN: Activity,
};

const activityColors: Record<string, string> = {
  WHITELIST_CREATED: 'text-green-400 bg-green-400/10',
  WHITELIST_UPDATED: 'text-blue-400 bg-blue-400/10',
  WHITELIST_DELETED: 'text-red-400 bg-red-400/10',
  REQUEST_SUBMITTED: 'text-yellow-400 bg-yellow-400/10',
  REQUEST_APPROVED: 'text-green-400 bg-green-400/10',
  REQUEST_REJECTED: 'text-red-400 bg-red-400/10',
  REPORT_VERIFIED: 'text-green-400 bg-green-400/10',
  REPORT_REJECTED: 'text-red-400 bg-red-400/10',
  SYNC_COMPLETED: 'text-wisesama-purple bg-wisesama-purple/10',
  ADMIN_LOGIN: 'text-blue-400 bg-blue-400/10',
};

export function RecentActivity({ activities, isLoading }: RecentActivityProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-heading font-semibold text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-white/10" />
              <div className="flex-1">
                <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="text-lg font-heading font-semibold text-white mb-4">
          Recent Activity
        </h3>
        <div className="flex flex-col items-center justify-center py-8 text-white/40">
          <AlertTriangle className="w-8 h-8 mb-2" />
          <p>No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-heading font-semibold text-white mb-4">
        Recent Activity
      </h3>
      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.type] || Activity;
          const colorClass =
            activityColors[activity.type] || 'text-white/60 bg-white/10';
          const [textColor, bgColor] = colorClass.split(' ');

          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bgColor}`}
              >
                <Icon className={`w-4 h-4 ${textColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{activity.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  {activity.userEmail && (
                    <span className="text-xs text-white/40">
                      {activity.userEmail}
                    </span>
                  )}
                  <span className="text-xs text-white/30">
                    {formatDateTime(activity.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
