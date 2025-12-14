'use client';

import { useState } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import { useParams } from 'next/navigation';
import { Search } from 'lucide-react';

interface SearchBarProps {
  defaultValue?: string;
  disabled?: boolean;
}

export function SearchBar({ defaultValue = '', disabled = false }: SearchBarProps) {
  const router = useTransitionRouter();
  const params = useParams();
  
  // Use defaultValue if provided, otherwise fallback to URL params
  const initialValue = defaultValue || (params?.entity ? decodeURIComponent(params.entity as string) : '');
  const [value, setValue] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      router.push(`/check/${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ viewTransitionName: 'search-bar' }}>
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 ${disabled ? 'text-gray-600' : 'text-muted-foreground'}`} />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter address, domain, or Twitter handle..."
          disabled={disabled}
          className={`w-full pl-12 pr-32 py-4 rounded-xl bg-wisesama-dark-secondary border border-border outline-none transition-all text-foreground placeholder:text-muted-foreground ${
            disabled
              ? 'opacity-60 cursor-not-allowed'
              : 'focus:border-wisesama-purple focus:ring-1 focus:ring-wisesama-purple'
          }`}
        />
        <button
          type="submit"
          disabled={disabled}
          className={`absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-lg font-medium transition-colors ${
            disabled
              ? 'bg-wisesama-purple/50 text-white/60 cursor-not-allowed'
              : 'bg-wisesama-purple text-white hover:bg-wisesama-purple-light'
          }`}
        >
          Check
        </button>
      </div>
    </form>
  );
}
