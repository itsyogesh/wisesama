import { createPageMetadata } from '@/lib/seo';
import DocsPage from './docs-page';

export const metadata = createPageMetadata({
  title: 'API Documentation',
  description: 'Dotsama API documentation. Analyze suspicious wallet addresses, domains, and entities with our fraud detection REST API for the Polkadot ecosystem.',
  path: '/docs',
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Dotsama API Documentation',
  description: 'Complete API reference for the Dotsama fraud detection platform.',
  url: 'https://wisesama.com/docs',
  author: { '@type': 'Organization', name: 'Dotsama' },
  about: {
    '@type': 'SoftwareApplication',
    name: 'Dotsama API',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
  },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DocsPage />
    </>
  );
}
