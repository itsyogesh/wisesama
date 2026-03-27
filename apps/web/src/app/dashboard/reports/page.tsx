import type { Metadata } from 'next';
import ReportsPage from './reports-page';

export const metadata: Metadata = { title: 'My Reports' };

export default function Page() {
  return <ReportsPage />;
}
