import { createPageMetadata } from '@/lib/seo';
import ReportPage from './report-page';

export const metadata = createPageMetadata({
  title: 'Report a Scam',
  description: 'Submit a fraud report to help protect the Polkadot ecosystem. Report phishing addresses, scam domains, and suspicious entities.',
  path: '/report',
});

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Report a Scam - Wisesama',
  description: 'Submit a fraud report to help protect the Polkadot ecosystem.',
  url: 'https://wisesama.com/report',
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ReportPage />
    </>
  );
}
