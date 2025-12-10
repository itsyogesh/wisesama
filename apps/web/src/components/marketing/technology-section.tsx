'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import Balancer from 'react-wrap-balancer';
import {
  Brain,
  Shield,
  UserCheck,
  AlertTriangle,
  Search,
  Globe,
  GitBranch,
  Fingerprint,
  Scan,
  Timer,
  Layers,
} from 'lucide-react';

const technologies = [
  {
    icon: Brain,
    title: 'ML Transaction Analysis',
    description:
      'Heuristic scoring engine extracting 21+ behavioral features including account age, counterparty diversity, and dust patterns.',
    color: 'from-violet-500 to-purple-600',
    glowColor: 'rgba(139, 92, 246, 0.3)',
    stats: '21+ features',
  },
  {
    icon: UserCheck,
    title: 'On-Chain Identity',
    description:
      'Deep verification using registrar judgements, identity timelines, and migration checks across Polkadot & Kusama chains.',
    color: 'from-emerald-500 to-teal-600',
    glowColor: 'rgba(16, 185, 129, 0.3)',
    stats: 'Multi-chain check',
  },
  {
    icon: AlertTriangle,
    title: 'Look-alike Detection',
    description:
      'Advanced Levenshtein distance algorithms instantly detect impersonation attempts against known ecosystem brands and handles.',
    color: 'from-amber-500 to-orange-600',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    stats: 'Fuzzy matching',
  },
  {
    icon: Shield,
    title: 'Blacklist & Whitelist',
    description:
      'Real-time cross-referencing against Polkadot-JS phishing lists and our curated whitelist of exchanges and foundations.',
    color: 'from-red-500 to-rose-600',
    glowColor: 'rgba(239, 68, 68, 0.3)',
    stats: '53k+ domains',
  },
  {
    icon: Globe,
    title: 'VirusTotal Integration',
    description:
      'Enterprise-grade domain scanning querying 70+ antivirus engines and threat intelligence feeds in parallel.',
    color: 'from-cyan-500 to-blue-600',
    glowColor: 'rgba(6, 182, 212, 0.3)',
    stats: '70+ engines',
  },
  {
    icon: GitBranch,
    title: 'Transaction Graph',
    description:
      'Trace fund flows to detect interactions with known scammer wallets, identifying money laundering attempts.',
    color: 'from-pink-500 to-fuchsia-600',
    glowColor: 'rgba(236, 72, 153, 0.3)',
    stats: 'Fund tracing',
  },
];

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
};

function TechCard({
  tech,
  index,
}: {
  tech: (typeof technologies)[0];
  index: number;
}) {
  const Icon = tech.icon;

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative"
    >
      {/* Glow effect on hover */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"
        style={{ background: tech.glowColor }}
      />

      <div className="relative h-full rounded-2xl bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800/50 p-6 backdrop-blur-sm overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }}
          />
        </div>

        {/* Icon with gradient background */}
        <div
          className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${tech.color} p-3 mb-5 shadow-lg`}
          style={{ boxShadow: `0 8px 32px ${tech.glowColor}` }}
        >
          <Icon className="w-full h-full text-white" strokeWidth={1.5} />

          {/* Animated pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              background: `linear-gradient(135deg, ${tech.glowColor}, transparent)`,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: index * 0.2,
            }}
          />
        </div>

        {/* Stats badge */}
        <div className="absolute top-6 right-6">
          <span className="px-3 py-1 rounded-full text-[10px] font-medium tracking-wider uppercase bg-white/5 text-gray-400 border border-white/10">
            {tech.stats}
          </span>
        </div>

        {/* Content */}
        <h3 className="font-heading text-xl font-semibold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-all">
          {tech.title}
        </h3>
        <p className="text-gray-400 text-sm leading-relaxed">
          {tech.description}
        </p>

        {/* Bottom accent line */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tech.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />
      </div>
    </motion.div>
  );
}

export function TechnologySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      className="relative py-24 lg:py-32 bg-wisesama-bg overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0">
        {/* Radial gradient glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-30"
          style={{
            background:
              'radial-gradient(circle, rgba(113, 46, 255, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 mb-6"
          >
            <Layers className="w-3 h-3 text-wisesama-purple" />
            <span className="text-xs font-medium text-wisesama-purple-light uppercase tracking-wider">
              Defense Architecture
            </span>
          </motion.div>

          <h2 className="font-heading font-semibold text-3xl md:text-5xl text-white mb-4">
            <Balancer>
              Built on a Six-Layer{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">
                Defense Matrix
              </span>
            </Balancer>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            <Balancer>
              We don't just rely on one signal. Wisesama aggregates data from
              on-chain behavior, global threat feeds, and identity registrars to
              eliminate false positives.
            </Balancer>
          </p>
        </motion.div>

        {/* Tech grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'show' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {technologies.map((tech, index) => (
            <TechCard key={tech.title} tech={tech} index={index} />
          ))}
        </motion.div>

        {/* Bottom stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-16 p-6 rounded-2xl bg-gradient-to-r from-zinc-900/80 via-zinc-900/50 to-zinc-900/80 border border-zinc-800/50 backdrop-blur-sm"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: Timer, label: 'Avg Response', value: '<2s' },
              { icon: Fingerprint, label: 'Entities Scanned', value: '100K+' },
              { icon: Shield, label: 'Threats Blocked', value: '5K+' },
              { icon: Search, label: 'Daily Scans', value: '1K+' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center">
                <div className="flex justify-center mb-2">
                  <Icon className="w-5 h-5 text-wisesama-purple-light" />
                </div>
                <div className="text-2xl font-heading font-bold text-white mb-1">
                  {value}
                </div>
                <div className="text-xs text-gray-500 uppercase tracking-wider">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
