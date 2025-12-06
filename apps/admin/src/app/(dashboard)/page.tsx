'use client';

import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { StatsCard } from '@/components/dashboard/stats-card';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { PendingRequests } from '@/components/dashboard/pending-requests';
import { statsApi, activityApi, whitelistRequestsApi } from '@/lib/api';
import {
  Shield,
  FileText,
  ClipboardList,
  Users,
  AlertTriangle,
} from 'lucide-react';

export default function DashboardPage() {
  // Fetch dashboard stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: statsApi.getDashboard,
  });

  // Fetch recent activity
  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => activityApi.getAll({ limit: 10 }),
  });

  // Fetch pending requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['pending-requests'],
    queryFn: () =>
      whitelistRequestsApi.getAll({ status: 'PENDING', limit: 5 }),
  });

  const stats = statsData?.data || {};
  const activities = activityData?.data?.items || [];
  const pendingRequests = requestsData?.data?.items || [];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        description="Overview of Wisesama platform activity"
      />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Whitelisted Entities"
            value={stats.totalWhitelisted || 0}
            change={stats.whitelistedChange}
            changeLabel="this week"
            icon={Shield}
            iconColor="text-wisesama-purple"
          />
          <StatsCard
            title="Pending Requests"
            value={stats.pendingRequests || 0}
            icon={FileText}
            iconColor="text-yellow-400"
          />
          <StatsCard
            title="Open Reports"
            value={stats.openReports || 0}
            icon={ClipboardList}
            iconColor="text-red-400"
          />
          <StatsCard
            title="Total Users"
            value={stats.totalUsers || 0}
            change={stats.usersChange}
            changeLabel="this week"
            icon={Users}
            iconColor="text-blue-400"
          />
        </div>

        {/* Alert banner for pending items */}
        {(stats.pendingRequests > 0 || stats.openReports > 0) && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-white">
                <span className="font-medium">Action required: </span>
                {stats.pendingRequests > 0 && (
                  <span>
                    {stats.pendingRequests} whitelist request
                    {stats.pendingRequests > 1 ? 's' : ''} pending review
                  </span>
                )}
                {stats.pendingRequests > 0 && stats.openReports > 0 && (
                  <span> and </span>
                )}
                {stats.openReports > 0 && (
                  <span>
                    {stats.openReports} report
                    {stats.openReports > 1 ? 's' : ''} to review
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PendingRequests
            requests={pendingRequests}
            isLoading={requestsLoading}
          />
          <RecentActivity
            activities={activities}
            isLoading={activityLoading}
          />
        </div>

        {/* Quick Stats */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-heading font-semibold text-white mb-4">
            Platform Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-white/60">Addresses Whitelisted</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats.addressesWhitelisted || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60">Domains Whitelisted</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats.domainsWhitelisted || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60">Twitter Accounts</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats.twitterWhitelisted || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60">Total Chains</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats.totalChains || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
