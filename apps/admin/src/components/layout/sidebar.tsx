'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard,
  Shield,
  FileText,
  ClipboardList,
  Users,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Whitelist',
    href: '/whitelist',
    icon: Shield,
  },
  {
    title: 'Requests',
    href: '/requests',
    icon: FileText,
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: ClipboardList,
  },
  {
    title: 'Contributions',
    href: '/contributions',
    icon: Users,
  },
  {
    title: 'Activity Log',
    href: '/activity',
    icon: Activity,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center">
          {collapsed ? (
            <Image
              src="/favicon.svg"
              alt="Wisesama"
              width={32}
              height={32}
              className="flex-shrink-0"
            />
          ) : (
            <Image
              src="/logo.svg"
              alt="Wisesama"
              width={140}
              height={24}
              className="h-6 w-auto"
            />
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-white/5'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">{item.title}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-white truncate">
              {user.email}
            </p>
            <p className="text-xs text-white/50 capitalize">{user.role}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors',
              collapsed ? 'w-full justify-center' : 'flex-1'
            )}
          >
            <LogOut className="w-5 h-5" />
            {!collapsed && <span className="text-sm">Logout</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
