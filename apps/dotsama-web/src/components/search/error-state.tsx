'use client';

import { AlertOctagon, RefreshCw, Home, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ErrorStateProps {
  entity?: string;
  error?: string;
  type?: 'not-found' | 'server-error' | 'network-error' | 'rate-limit';
}

const errorConfig = {
  'not-found': {
    icon: Search,
    title: 'Entity Not Found',
    description: 'We couldn\'t find any information about this entity in our database.',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
  },
  'server-error': {
    icon: AlertOctagon,
    title: 'Analysis Failed',
    description: 'Our servers encountered an error while analyzing this entity. Please try again.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  'network-error': {
    icon: AlertOctagon,
    title: 'Connection Error',
    description: 'Unable to connect to our servers. Please check your internet connection.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  'rate-limit': {
    icon: AlertOctagon,
    title: 'Too Many Requests',
    description: 'You\'ve made too many requests. Please wait a moment before trying again.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
};

export function ErrorState({ entity, error, type = 'server-error' }: ErrorStateProps) {
  const router = useRouter();
  const config = errorConfig[type];
  const Icon = config.icon;

  const handleRetry = () => {
    if (entity) {
      router.refresh();
    } else {
      router.back();
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Card */}
      <div className={`rounded-xl ${config.bgColor} border ${config.borderColor} overflow-hidden`}>
        {/* Header with animated background */}
        <div className="relative p-8 overflow-hidden">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="error-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M0 32V0h32" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#error-grid)" />
            </svg>
          </div>

          {/* Animated ring */}
          <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-20">
            <div className={`w-32 h-32 rounded-full border-2 ${config.borderColor} animate-pulse`} />
            <div className={`absolute inset-4 rounded-full border ${config.borderColor} animate-[ping_3s_ease-in-out_infinite]`} />
          </div>

          <div className="relative flex flex-col items-center text-center">
            {/* Icon */}
            <div className={`p-4 rounded-2xl ${config.bgColor} border ${config.borderColor} mb-6`}>
              <Icon className={`h-8 w-8 ${config.color}`} />
            </div>

            {/* Title */}
            <h2 className={`font-heading text-2xl font-bold ${config.color} mb-2`}>
              {config.title}
            </h2>

            {/* Description */}
            <p className="text-gray-400 max-w-md mb-2">
              {config.description}
            </p>

            {/* Entity display */}
            {entity && (
              <div className="mt-4 px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                <p className="text-sm text-gray-500">Searched entity:</p>
                <p className="font-mono text-gray-300 break-all">{entity}</p>
              </div>
            )}

            {/* Technical error message */}
            {error && (
              <details className="mt-4 text-left w-full max-w-md">
                <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-500 transition-colors">
                  Technical details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-zinc-900/50 text-xs text-gray-500 overflow-x-auto">
                  {error}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-zinc-800/50 bg-zinc-900/30">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRetry}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg ${config.bgColor} ${config.color} font-medium border ${config.borderColor} hover:bg-opacity-80 transition-all group`}
            >
              <RefreshCw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
              Try Again
            </button>
            <Link
              href="/check"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-800/50 text-gray-300 font-medium border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
            >
              <Search className="h-4 w-4" />
              New Search
            </Link>
            <Link
              href="/"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-800/50 text-gray-300 font-medium border border-zinc-700/50 hover:bg-zinc-800 transition-colors"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
          </div>
        </div>
      </div>

      {/* Helpful tips */}
      <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Troubleshooting tips:</h3>
        <ul className="space-y-2 text-sm text-gray-500">
          <li className="flex items-start gap-2">
            <span className="text-wisesama-purple-light mt-1">•</span>
            <span>Make sure the address or handle is spelled correctly</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-wisesama-purple-light mt-1">•</span>
            <span>For blockchain addresses, verify you're using the correct format</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-wisesama-purple-light mt-1">•</span>
            <span>Twitter handles should not include the @ symbol</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-wisesama-purple-light mt-1">•</span>
            <span>If the problem persists, please try again in a few minutes</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
