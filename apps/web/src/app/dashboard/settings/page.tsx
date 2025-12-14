'use client';

import { useAuthStore } from '@/stores/use-auth-store';
import { User, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account preferences</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile Card */}
        <div className="bg-[#1F242F] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-wisesama-purple-light" />
            Profile
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Email</label>
              <div className="text-white font-medium">{user?.email}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">User ID</label>
              <div className="font-mono text-sm text-gray-400 bg-black/20 p-2 rounded border border-white/5 inline-block">
                {user?.id}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-[#1F242F] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-400" />
            Subscription
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium capitalize mb-1">{user?.tier || 'Free'} Plan</div>
              <p className="text-sm text-gray-400">
                You are currently on the free tier. Upgrade for higher limits.
              </p>
            </div>
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/10">
              Manage Billing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
