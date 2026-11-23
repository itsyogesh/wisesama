import type { Metadata } from 'next';
import MyReportsPage from './my-reports-page';

export const metadata: Metadata = {
  title: 'My Reports',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <MyReportsPage />;
}
