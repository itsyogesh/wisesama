'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

export function HeroSection() {
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/check/${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-wisesama-purple/10 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 mb-8">
            <Shield className="h-4 w-4 text-wisesama-purple" />
            <span className="text-sm text-wisesama-purple-light">
              Protecting the Polkadot Ecosystem
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Detect Fraud in the{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">
              Dotsama
            </span>{' '}
            Ecosystem
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Check wallet addresses, domains, and social handles against our database of known
            scams, phishing sites, and malicious actors.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-12">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
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

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-wisesama-status-fraud mb-1">
                54K+
              </div>
              <div className="text-sm text-muted-foreground">Phishing Sites</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-wisesama-status-caution mb-1">
                279+
              </div>
              <div className="text-sm text-muted-foreground">Flagged Addresses</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-wisesama-status-safe mb-1">
                99.9%
              </div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
