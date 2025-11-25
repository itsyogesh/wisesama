'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

interface SearchBarProps {
  defaultValue?: string;
}

export function SearchBar({ defaultValue = '' }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      router.push(`/check/${encodeURIComponent(value.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter address, domain, or Twitter handle..."
          className="w-full pl-12 pr-32 py-4 rounded-xl bg-wisesama-dark-secondary border border-border focus:border-wisesama-purple focus:ring-1 focus:ring-wisesama-purple outline-none transition-all text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-lg bg-wisesama-purple text-white font-medium hover:bg-wisesama-purple-light transition-colors"
        >
          Check
        </button>
      </div>
    </form>
  );
}
