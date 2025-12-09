'use client';

import { useState } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import { motion } from 'motion/react';
import { AlertTriangle, Globe2, Network, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fadeInUp } from '@/lib/motion';

export function HeroSection() {
  const [search, setSearch] = useState('');
  const router = useTransitionRouter();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (search.trim()) {
      router.push(`/check?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleReport = () => {
    router.push('/report');
  };

  const capabilityPills = [
    { label: '70+ Threat Intel Feeds', icon: Globe2 },
    { label: 'Smart Impersonation Detection', icon: Network },
    { label: 'On-chain Identity Proofs', icon: ShieldCheck },
  ];

  const highlightCards = [
    {
      title: '360° Risk Scoring',
      copy: 'Combines ML, reputation, and identity signals.',
      icon: Sparkles,
    },
    {
      title: 'Community Defense',
      copy: 'Crowdsourced intelligence with strict validation.',
      icon: AlertTriangle,
    },
    {
      title: 'Enterprise Ready',
      copy: 'High-performance APIs and real-time alerts.',
      icon: Zap,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0B0B11] min-h-[90vh] flex items-center">
      {/* Layered background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0c1f] via-[#0b0b11] to-[#0b0b11]" />
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-wisesama-purple/10 blur-[120px]" />
        <div
          className="absolute bottom-[-200px] right-0 w-[800px] h-[800px] rounded-full blur-[180px]"
          style={{ backgroundColor: 'rgba(138, 16, 111, 0.15)' }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10 py-12 lg:py-20">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 xl:gap-24 items-center">
          {/* Text + form */}
          <div className="space-y-10">
            <div className="space-y-6">
              <motion.div
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur"
              >
                <span className="w-2 h-2 rounded-full bg-wisesama-purple animate-pulse" />
                <span className="text-[11px] uppercase tracking-[0.14em] text-gray-300 font-bold">
                  Intelligent Risk Defense
                </span>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.6, delay: 0.05 }}
                className="font-heading font-semibold text-4xl md:text-6xl leading-[1.05] text-white tracking-tight"
              >
                Verify Every Wallet, Domain, and Handle in Seconds.
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-lg text-gray-400 max-w-2xl leading-relaxed"
              >
                Stop relying on guesswork. Wisesama combines behavioral ML, 70+ VirusTotal engines, and registrar-backed identity checks to give you a definitive risk score for any entity in the Dotsama ecosystem.
              </motion.p>
            </div>

            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.6, delay: 0.25 }}
              className="space-y-6"
            >
              <form 
                onSubmit={handleSearch} 
                className="w-full max-w-2xl relative group"
                style={{ viewTransitionName: 'search-bar' }}
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-wisesama-purple/50 to-wisesama-purple-accent/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative flex items-center bg-[#0F0F12] border border-white/10 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-wisesama-purple/50 focus-within:border-wisesama-purple/50 transition-all shadow-2xl">
                  <div className="pl-4 text-gray-500">
                    <Search className="h-6 w-6" />
                  </div>
                  <Input
                    placeholder="Paste address (0x..), domain (example.com), or handle (@name)"
                    className="flex-1 bg-transparent border-none text-white placeholder:text-gray-500 h-14 text-lg focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button
                    type="submit"
                    className="h-12 px-8 rounded-xl bg-wisesama-purple hover:bg-wisesama-purple-accent text-white font-medium transition-all hover:scale-105"
                  >
                    Search
                  </Button>
                </div>
              </form>

              <div className="flex flex-wrap gap-3">
                {capabilityPills.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-gray-400 backdrop-blur hover:bg-white/10 transition-colors cursor-default"
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                    {label}
                  </span>
                ))}
              </div>

              <div className="flex gap-4 pt-2">
                <Button
                  className="h-12 px-8 rounded-xl bg-wisesama-purple hover:bg-wisesama-purple-accent text-white shadow-lg shadow-wisesama-purple/20 transition-all hover:-translate-y-0.5"
                  onClick={() => document.querySelector('input')?.focus()}
                >
                  Start a scan
                </Button>
                <Button
                  variant="outline"
                  className="h-12 px-8 rounded-xl border-white/10 text-gray-300 bg-white/5 hover:bg-white/10 hover:text-white transition-all hover:-translate-y-0.5"
                  onClick={handleReport}
                >
                  Report a scam
                </Button>
              </div>
            </motion.div>
          </div>

          {/* Visual + quick stats */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:block"
          >
            <div className="relative rounded-3xl border border-white/10 bg-[#13131A] shadow-2xl overflow-hidden backdrop-blur-sm">
              {/* Top Bar */}
              <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/[0.02]">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-wisesama-purple to-wisesama-purple-accent flex items-center justify-center text-white shadow-lg shadow-wisesama-purple/20">
                  <Zap className="w-6 h-6" fill="currentColor" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-1">Live Threat Coverage</p>
                  <p className="text-white text-lg font-medium">Wallets • Domains • Socials • Email</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Verified Reports', value: '2.1k', sub: 'community sourced' },
                    { label: 'Entities Indexed', value: '100k+', sub: 'continuously updated' },
                    { label: 'Active Monitors', value: '920', sub: 'watchlists running' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl bg-black/20 border border-white/5 p-5">
                      <div className="text-3xl font-heading font-semibold text-white mb-1">{item.value}</div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">{item.label}</div>
                      <div className="text-[10px] text-gray-600">{item.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Features Row */}
                <div className="grid grid-cols-3 gap-4">
                  {highlightCards.map(({ title, copy, icon: Icon }) => (
                    <div key={title} className="rounded-2xl bg-wisesama-purple/5 border border-wisesama-purple/10 p-4 flex flex-col gap-3 group hover:bg-wisesama-purple/10 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-wisesama-purple/20 flex items-center justify-center group-hover:bg-wisesama-purple/30 transition-colors">
                        <Icon className="w-4 h-4 text-wisesama-purple-light" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white mb-1.5">{title}</p>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
