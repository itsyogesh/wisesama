'use client';

import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import { Search, Cpu, Shield, FileCheck } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Enter Entity',
    description:
      'Paste any wallet address, domain, Twitter handle, or email you want to verify.',
    color: '#712EFF',
  },
  {
    number: '02',
    icon: Cpu,
    title: 'Multi-Layer Analysis',
    description:
      'Our system runs 6 parallel analysis engines: ML scoring, identity verification, look-alike detection, blacklist/whitelist lookup, VirusTotal scan, and transaction graph analysis.',
    color: '#10B981',
  },
  {
    number: '03',
    icon: Shield,
    title: 'Risk Assessment',
    description:
      'Get a comprehensive risk score from SAFE to FRAUD with detailed breakdown of each analysis layer.',
    color: '#F59E0B',
  },
  {
    number: '04',
    icon: FileCheck,
    title: 'Take Action',
    description:
      'View detailed report, report suspicious entities, or request whitelist verification for legitimate projects.',
    color: '#EC4899',
  },
];

export function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      className="relative py-24 lg:py-32 bg-wisesama-bg overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        {/* Gradient line */}
        <div
          className="absolute left-1/2 top-0 bottom-0 w-px hidden lg:block"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(113, 46, 255, 0.3) 20%, rgba(113, 46, 255, 0.3) 80%, transparent 100%)',
          }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20 mb-6"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-wisesama-purple"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
            <span className="text-sm font-medium text-wisesama-purple-light">
              Simple Process
            </span>
          </motion.div>

          <h2 className="font-heading text-4xl md:text-5xl font-semibold text-white mb-4">
            How It{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">
              Works
            </span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From input to comprehensive risk assessment in under 2 seconds.
            Here's how Wisesama protects you.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLeft = index % 2 === 0;

            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.15 }}
                className={`relative flex items-center gap-8 mb-16 last:mb-0 ${
                  isLeft ? 'lg:flex-row' : 'lg:flex-row-reverse'
                } flex-col lg:text-left text-center`}
              >
                {/* Step content */}
                <div className={`flex-1 ${isLeft ? 'lg:text-right' : 'lg:text-left'}`}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="inline-block relative p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm"
                  >
                    {/* Step number */}
                    <span
                      className="absolute -top-3 font-heading text-6xl font-bold opacity-10"
                      style={{ color: step.color, [isLeft ? 'right' : 'left']: '-12px' }}
                    >
                      {step.number}
                    </span>

                    <h3 className="font-heading text-xl font-semibold text-white mb-2 relative">
                      {step.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-sm relative">
                      {step.description}
                    </p>
                  </motion.div>
                </div>

                {/* Center icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="relative z-10 order-first lg:order-none"
                >
                  {/* Glow */}
                  <div
                    className="absolute inset-0 rounded-2xl blur-xl opacity-50"
                    style={{ background: step.color }}
                  />
                  {/* Icon box */}
                  <div
                    className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                    style={{
                      background: `linear-gradient(135deg, ${step.color}, ${step.color}99)`,
                    }}
                  >
                    <Icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                  </div>
                  {/* Connection line to center */}
                  <div
                    className="hidden lg:block absolute top-1/2 w-8 h-px"
                    style={{
                      background: step.color,
                      [isLeft ? 'right' : 'left']: '-32px',
                      opacity: 0.3,
                    }}
                  />
                </motion.div>

                {/* Empty space for alternating layout */}
                <div className="flex-1 hidden lg:block" />
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <div className="inline-flex items-center gap-4 p-2 rounded-full bg-zinc-900/50 border border-zinc-800/50">
            <span className="pl-4 text-gray-400 text-sm">
              Ready to protect yourself?
            </span>
            <a
              href="/check"
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-wisesama-purple to-wisesama-purple-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start Scanning
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
