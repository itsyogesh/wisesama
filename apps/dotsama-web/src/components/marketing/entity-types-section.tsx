'use client';

import { motion, useInView } from 'motion/react';
import { useRef, useState } from 'react';
import Balancer from 'react-wrap-balancer';
import { Wallet, Globe, Twitter, Mail, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import Link from 'next/link';

const entityTypes = [
  {
    id: 'address',
    icon: Wallet,
    name: 'Wallet Address',
    subtitle: 'Polkadot & Kusama',
    description: 'Scan any Substrate address for fraud indicators, identity verification, and ML-powered transaction analysis.',
    features: [
      'ML fraud probability scoring',
      'On-chain identity verification',
      'Transaction pattern analysis',
      'Blacklist/whitelist lookup',
      'Identity timeline history',
    ],
    color: 'from-pink-500 via-rose-500 to-red-500',
    bgGlow: 'rgba(236, 72, 153, 0.15)',
    example: '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5',
  },
  {
    id: 'domain',
    icon: Globe,
    name: 'Web Domain',
    subtitle: 'URL & Website',
    description: 'Check domains against phishing databases and scan with 70+ security engines via VirusTotal integration.',
    features: [
      'VirusTotal 70+ engine scan',
      'Phishing database check',
      'Malware detection',
      'Community reports lookup',
      'Linked identity discovery',
    ],
    color: 'from-cyan-500 via-blue-500 to-indigo-500',
    bgGlow: 'rgba(6, 182, 212, 0.15)',
    example: 'polkadot.network',
  },
  {
    id: 'twitter',
    icon: Twitter,
    name: 'Twitter Handle',
    subtitle: 'Social Account',
    description: 'Detect impersonation attempts using Levenshtein distance and find linked on-chain identities.',
    features: [
      'Impersonation detection',
      'Look-alike analysis',
      'Known handle comparison',
      'Linked identity lookup',
      'Community reports',
    ],
    color: 'from-sky-500 via-blue-500 to-violet-500',
    bgGlow: 'rgba(56, 189, 248, 0.15)',
    example: '@polkadot',
  },
  {
    id: 'email',
    icon: Mail,
    name: 'Email Address',
    subtitle: 'Contact Verification',
    description: 'Verify email addresses linked to on-chain identities and check against known scam databases.',
    features: [
      'On-chain identity link',
      'Scam database lookup',
      'Identity verification',
      'Domain validation',
      'Risk assessment',
    ],
    color: 'from-emerald-500 via-teal-500 to-cyan-500',
    bgGlow: 'rgba(16, 185, 129, 0.15)',
    example: 'contact@polkadot.network',
  },
];

function EntityCard({ entity, isActive, onClick }: {
  entity: typeof entityTypes[0];
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = entity.icon;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative w-full p-5 rounded-xl text-left transition-all duration-300 ${
        isActive
          ? 'bg-zinc-800/80 border-wisesama-purple/50'
          : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
      } border backdrop-blur-sm`}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute inset-0 rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${entity.bgGlow}, transparent)`,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}

      <div className="relative flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${entity.color} shadow-lg`}
          style={isActive ? { boxShadow: `0 8px 32px ${entity.bgGlow}` } : {}}
        >
          <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <h3 className="font-heading font-semibold text-white text-lg">
            {entity.name}
          </h3>
          <p className="text-gray-500 text-sm">{entity.subtitle}</p>
        </div>
        <ArrowRight
          className={`w-5 h-5 transition-all duration-300 ${
            isActive ? 'text-wisesama-purple-light translate-x-1' : 'text-gray-600'
          }`}
        />
      </div>
    </motion.button>
  );
}

export function EntityTypesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const [activeIndex, setActiveIndex] = useState(0);
  const activeEntity = entityTypes[activeIndex]!;
  const ActiveIcon = activeEntity.icon;

  return (
    <section
      ref={ref}
      className="relative py-24 lg:py-32 bg-[#0B0B11] overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
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
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 mb-6"
          >
            <Search className="w-4 h-4 text-wisesama-purple-light" />
            <span className="text-sm font-medium text-wisesama-purple-light">
              Scan Anything
            </span>
          </motion.div>

          <h2 className="font-heading font-semibold text-4xl md:text-5xl text-white mb-4">
            <Balancer>
              What Can You{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">
                Scan?
              </span>
            </Balancer>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            <Balancer>
              From wallet addresses to social handles, we analyze every type of entity
              in the Polkadot ecosystem for potential threats.
            </Balancer>
          </p>
        </motion.div>

        {/* Two column layout */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Left: Entity selector */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-3"
          >
            {entityTypes.map((entity, index) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                isActive={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </motion.div>

          {/* Right: Details panel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            {/* Background glow */}
            <motion.div
              key={activeEntity.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -inset-8 rounded-3xl opacity-50 blur-3xl"
              style={{ background: activeEntity.bgGlow }}
            />

            {/* Details card */}
            <div className="relative rounded-2xl bg-zinc-900/80 border border-zinc-800/50 p-8 backdrop-blur-sm">
              {/* Header */}
              <div className="flex items-start gap-5 mb-6">
                <motion.div
                  key={activeEntity.id + '-icon'}
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${activeEntity.color} shadow-xl`}
                  style={{ boxShadow: `0 12px 40px ${activeEntity.bgGlow}` }}
                >
                  <ActiveIcon className="w-8 h-8 text-white" strokeWidth={1.5} />
                </motion.div>
                <div>
                  <motion.h3
                    key={activeEntity.id + '-title'}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-heading text-2xl font-semibold text-white mb-1"
                  >
                    {activeEntity.name}
                  </motion.h3>
                  <p className="text-gray-500">{activeEntity.subtitle}</p>
                </div>
              </div>

              {/* Description */}
              <motion.p
                key={activeEntity.id + '-desc'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-400 mb-6 leading-relaxed"
              >
                {activeEntity.description}
              </motion.p>

              {/* Example input */}
              <div className="mb-6">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Example
                </span>
                <div className="mt-2 px-4 py-3 rounded-lg bg-black/50 border border-zinc-800/50 font-mono text-sm text-gray-400 truncate">
                  {activeEntity.example}
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wider">
                  Analysis Includes
                </span>
                <motion.div
                  key={activeEntity.id + '-features'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 gap-2.5 mt-3"
                >
                  {activeEntity.features.map((feature, index) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <CheckCircle2 className="w-4 h-4 text-wisesama-purple-light flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>

              {/* CTA */}
              <div className="mt-8">
                <Link
                  href="/check"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-wisesama-purple to-wisesama-purple-accent text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Scan Now
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
