"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { AlertTriangle, BarChart3, Bell, Globe2, ServerCog, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

const features = [
  {
    title: "Layered intelligence",
    description:
      "ML fraud scoring, Levenshtein look‑alike checks, and registrar-backed identity verification in one pass.",
    icon: Sparkles,
    badge: "Risk scoring",
    points: ["95%+ precision wallet scoring", "Impersonation detection for socials", "Registrar judgements & identity timeline"],
  },
  {
    title: "Web & malware defense",
    description:
      "VirusTotal-powered domain scans with 70+ engines plus phishing blocklists tuned for Polkadot & Kusama.",
    icon: Globe2,
    badge: "VirusTotal",
    points: ["70+ AV engines", "Malware + phishing verdicts", "Domain reputation with context"],
  },
  {
    title: "Team-ready workflows",
    description:
      "Report intake with evidence, rate limits to stop abuse, and alerting for watchlisted entities as they move.",
    icon: Bell,
    badge: "Ops",
    points: ["Structured reports & triage", "Rate-limit + allowlist controls", "Realtime alerts to email/Slack"],
  },
  {
    title: "API-first platform",
    description:
      "Scan and submit directly from your tools. Reuse our scoring, allowlists, and evidence across your stack.",
    icon: ServerCog,
    badge: "Developers",
    points: ["/check, /report endpoints", "Signed webhook callbacks", "Sandbox + prod keys"],
    cta: { label: "Read the docs", href: "/docs" },
  },
];

function FeatureCard({ feature, index }: { feature: (typeof features)[0]; index: number }) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 120, damping: 18 }}
      className="relative group h-full"
    >
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-wisesama-purple/25 via-transparent to-wisesama-purple/10 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
      <div className="relative h-full rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur px-6 py-7 flex flex-col gap-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-wisesama-purple to-wisesama-purple-accent flex items-center justify-center shadow-lg shadow-wisesama-purple/30">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-400 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            {feature.badge}
          </span>
        </div>

        <div className="space-y-2">
          <h3 className="font-heading text-2xl text-white">{feature.title}</h3>
          <p className="text-gray-400 leading-relaxed">{feature.description}</p>
        </div>

        <div className="space-y-2">
          {feature.points.map((point) => (
            <div key={point} className="flex items-start gap-2 text-sm text-gray-200">
              <ShieldCheck className="w-4 h-4 text-wisesama-purple-light mt-0.5" />
              <span className="leading-relaxed">{point}</span>
            </div>
          ))}
        </div>

        {feature.cta && (
          <Link
            href={feature.cta.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-wisesama-purple-light hover:text-white transition-colors"
          >
            {feature.cta.label}
            <BarChart3 className="w-4 h-4" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export function FeaturesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="relative py-24 bg-[#0b0b11] overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "36px 36px" }} />
      <div className="absolute top-10 left-[5%] w-[480px] h-[480px] rounded-full bg-wisesama-purple/15 blur-[150px]" />
      <div className="absolute bottom-0 right-[3%] w-[380px] h-[380px] rounded-full" style={{ backgroundColor: "rgba(138,16,111,0.25)" }} />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-14 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs uppercase tracking-[0.14em] text-gray-300">
            Built for real incidents
          </div>
          <h2 className="font-heading text-4xl md:text-5xl text-white">Everything you need to scan and respond</h2>
          <p className="text-gray-400 text-lg">
            Keep the new intelligence—VirusTotal scans, Levenshtein impersonation checks, registrar identity proofs—while making the page feel cohesive and intentional.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
