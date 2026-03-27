import { createPageMetadata } from '@/lib/seo';
import RequestPage from './request-page';

export const metadata = createPageMetadata({
  title: 'Request Whitelist Verification',
  description: 'Submit your project or entity for verification to be included in the Wisesama trusted directory. Help build a safe Polkadot ecosystem.',
  path: '/whitelist-request',
});

export default function Page() {
  return <RequestPage />;
}
