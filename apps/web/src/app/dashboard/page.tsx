import type { Metadata } from 'next';
import DashboardOverview from './dashboard-overview';

export const metadata: Metadata = { title: 'Overview' };

export default function Page() {
  return <DashboardOverview />;
}
