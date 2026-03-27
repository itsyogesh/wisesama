import { createPageMetadata } from '@/lib/seo';
import DocsPage from './docs-page';

export const metadata = createPageMetadata({
  title: 'API Documentation',
  description: 'Wisesama API documentation. Analyze suspicious wallet addresses, domains, and entities with our fraud detection REST API for the Polkadot ecosystem.',
  path: '/docs',
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'Wisesama API Documentation',
  description: 'Complete API reference for the Wisesama fraud detection platform.',
  url: 'https://wisesama.com/docs',
  author: { '@type': 'Organization', name: 'Wisesama' },
  about: {
    '@type': 'SoftwareApplication',
    name: 'Wisesama API',
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
