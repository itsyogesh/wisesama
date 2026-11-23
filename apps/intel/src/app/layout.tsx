import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';
import '../components/finding-detail.css';

export const metadata: Metadata = {
  title: 'Wisesama · Security response',
  description:
    'Match your software inventory to sourced vulnerability intelligence and track your response.',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="ui-root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
