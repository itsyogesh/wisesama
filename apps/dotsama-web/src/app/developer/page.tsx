import { createPageMetadata } from '@/lib/seo';
import DeveloperPage from './developer-page';

export const metadata = createPageMetadata({
  title: 'Developer Portal',
  description: 'Generate API keys and integrate Dotsama fraud detection into your applications. REST API for the Polkadot ecosystem.',
  path: '/developer',
});

export default function Page() {
  return <DeveloperPage />;
}
