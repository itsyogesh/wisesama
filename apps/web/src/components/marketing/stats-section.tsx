"use client";

import { motion, useInView } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import Balancer from 'react-wrap-balancer';
import { AlertTriangle, Shield, Users, Activity } from 'lucide-react';

interface AnimatedCounterProps {
  end: number;
  duration?: number;
  suffix?: string;
}

function AnimatedCounter({ end, duration = 2, suffix = '+' }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref);

  useEffect(() => {
    if (isInView) {
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min(
          (currentTime - startTime) / (duration * 1000),
          1
        );
        setCount(Math.floor(progress * end));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, end, duration]);

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix && <span className="text-purple-300">{suffix}</span>}
    </span>
  );
}

interface StatItemProps {
  value: number;
  label: string;
  delay?: number;
  suffix?: string;
}

function StatItem({ value, label, delay = 0, suffix }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="text-center space-y-2"
    >
      <div className="font-heading font-bold text-4xl md:text-5xl text-white">
        <AnimatedCounter end={value} suffix={suffix} />
      </div>
      <p className="text-gray-400">{label}</p>
    </motion.div>
  );
}

export function StatsSection() {
  const cards = [
    {
      label: 'Reports processed',
      value: 213,
      icon: AlertTriangle,
      suffix: '+',
      detail: 'community-verified submissions',
    },
    {
      label: 'Users protected',
      value: 723,
      icon: Users,
      suffix: '+',
      detail: 'teams, traders, and investigators',
    },
    {
      label: 'Active monitors',
      value: 920,
      icon: Shield,
      suffix: '+',
      detail: 'live allowlists & watchlists',
    },
  ];

  return (
    <section className="relative py-14 bg-wisesama-bg overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wisesama-purple/10 border border-wisesama-purple/20"
          >
            <Activity className="w-4 h-4 text-wisesama-purple-light" />
            <span className="text-sm font-medium text-wisesama-purple-light">
              Live Trust Signals
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-semibold text-4xl md:text-5xl text-white"
          >
            <Balancer>
              Our Network Gets{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-wisesama-purple to-wisesama-purple-light">
                Stronger
              </span>
            </Balancer>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.08 * idx }}
                className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/0 to-white/5 backdrop-blur p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-wisesama-purple to-transparent opacity-60" />
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-wisesama-purple to-wisesama-purple-accent flex items-center justify-center shadow-lg shadow-wisesama-purple/30">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-gray-400">Updated live</span>
                </div>
                <div className="text-4xl font-heading font-bold text-white flex items-baseline gap-1">
                  <AnimatedCounter end={card.value} suffix={card.suffix} />
                </div>
                <p className="mt-1 text-gray-300 font-medium">{card.label}</p>
                <p className="text-sm text-gray-500">{card.detail}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
