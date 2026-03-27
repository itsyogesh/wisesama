import { createPageMetadata } from '@/lib/seo';
import BlacklistPage from './blacklist-page';

export const metadata = createPageMetadata({
  title: 'Blacklist - Known Scam Addresses & Domains',
  description: 'Browse a database of known malicious wallet addresses, domains, and social handles involved in phishing, scams, and rug pulls in the Polkadot ecosystem.',
  path: '/blacklist',
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DataCatalog',
  name: 'Wisesama Blacklist',
  description: 'Database of known malicious addresses, domains, and social handles in the Polkadot ecosystem.',
  url: 'https://wisesama.com/blacklist',
  provider: { '@type': 'Organization', name: 'Wisesama', url: 'https://wisesama.com' },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlacklistPage />
    </>
  );
}
