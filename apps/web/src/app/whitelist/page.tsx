import { createPageMetadata } from '@/lib/seo';
import WhitelistPage from './whitelist-page';

export const metadata = createPageMetadata({
  title: 'Whitelist - Trusted Polkadot Entities',
  description: 'A curated directory of verified projects, exchanges, validators, and infrastructure providers in the Polkadot ecosystem.',
  path: '/whitelist',
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DataCatalog',
  name: 'Wisesama Whitelist Directory',
  description: 'Curated list of verified Polkadot ecosystem projects, exchanges, and infrastructure providers.',
  url: 'https://wisesama.com/whitelist',
  provider: { '@type': 'Organization', name: 'Wisesama', url: 'https://wisesama.com' },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <WhitelistPage />
    </>
  );
}
