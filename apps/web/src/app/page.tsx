import {
  HeroSection,
  StatsSection,
  FeaturesSection,
  TechnologySection,
  EntityTypesSection,
  HowItWorksSection,
  RecentSpamsTicker,
  RecentReportsSection,
  BlogsSection,
} from '@/components/marketing';
import { getAllPosts, formatDate } from '@/lib/blog';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Wisesama',
  description:
    'Polkadot ecosystem fraud detection platform. Detect crypto fraud, phishing, ransomware, and money laundering in the Dotsama ecosystem.',
  url: 'https://wisesama.com',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  provider: {
    '@type': 'Organization',
    name: 'Wisesama',
    url: 'https://wisesama.com',
  },
  featureList: [
    'Wallet address risk assessment',
    'Domain phishing detection',
    'Twitter handle impersonation detection',
    'On-chain identity verification',
    'Community-driven fraud reporting',
    'Real-time threat intelligence',
  ],
};

export default function HomePage() {
  const posts = getAllPosts().map((post) => ({
    ...post,
    date: formatDate(post.date),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroSection />
      <StatsSection />
      <RecentSpamsTicker />
      <EntityTypesSection />
      <TechnologySection />
      <HowItWorksSection />
      <FeaturesSection />
      <RecentReportsSection />
      <BlogsSection posts={posts} />
    </>
  );
}
