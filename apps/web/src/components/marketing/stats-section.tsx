'use client';

import { motion, useInView } from 'motion/react';
import { useRef, useEffect, useState } from 'react';

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
  return (
    <section className="py-16 bg-[#1A1A1A]">
      <div className="w-full text-center mb-10">
        <span className="text-3xl font-bold text-white">
          Our Stats
        </span>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-center md:space-x-12 space-y-8 md:space-y-0">
        <StatItem value={213} label="Reports" delay={0.1} />

        <span className="hidden md:inline-block h-[50px] border-l border-white" />

        <StatItem value={723} label="Users" delay={0.2} />

        <span className="hidden md:inline-block h-[50px] border-l border-white" />

        <StatItem value={920} label="Active Accounts" delay={0.3} />
      </div>
    </section>
  );
}
