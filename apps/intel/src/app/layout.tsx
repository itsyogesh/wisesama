import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';
import '../components/finding-detail.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.wisesama.com'),
  title: 'Wisesama · Security response',
  description:
    'Find affected dependencies, prepare a coding-agent handoff, and keep fix, test, and deployment evidence together.',
  robots: { index: true, follow: true },
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
