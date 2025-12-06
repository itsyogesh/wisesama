'use client';

import { useAuth } from '@/hooks/use-auth';
import { Bell, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-heading font-semibold text-white">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-white/50">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Search..."
            className="input-field pl-10 pr-4 py-2 w-64 text-sm"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-wisesama-purple" />
        </button>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="w-8 h-8 rounded-full bg-wisesama-purple/20 flex items-center justify-center">
              <span className="text-sm font-medium text-wisesama-purple">
                {user.email.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
