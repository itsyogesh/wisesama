import { Shield, Zap, Globe, Bell, Code, Users } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Real-time Protection',
    description:
      'Instantly check addresses and domains against our constantly updated database of known threats.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast API',
    description:
      'Integrate fraud detection into your wallet or dApp with our high-performance REST API.',
  },
  {
    icon: Globe,
    title: 'Polkadot Native',
    description:
      'Built specifically for the Dotsama ecosystem with on-chain identity verification.',
  },
  {
    icon: Bell,
    title: 'Real-time Alerts',
    description:
      'Monitor addresses and receive instant notifications when suspicious activity is detected.',
  },
  {
    icon: Code,
    title: 'Developer Friendly',
    description:
      'Comprehensive API documentation and SDKs for seamless integration.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    description:
      'Powered by community reports and the polkadot-js phishing database.',
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 bg-wisesama-dark-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
            Why Choose Wisesama?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive fraud detection tools designed for the Polkadot ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-xl bg-wisesama-dark border border-border/40 hover:border-wisesama-purple/40 transition-colors"
            >
              <div className="h-12 w-12 rounded-lg bg-wisesama-purple/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-wisesama-purple" />
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
