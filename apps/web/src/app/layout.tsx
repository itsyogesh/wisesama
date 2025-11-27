import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { SiteHeader, SiteFooter } from '@/components/layout';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: {
    default: 'Wisesama - Polkadot Fraud Detection',
    template: '%s | Wisesama',
  },
  description:
    'Detect crypto fraud, phishing, ransomware, and money laundering in the Polkadot/Dotsama ecosystem.',
  keywords: [
    'polkadot',
    'kusama',
    'fraud detection',
    'crypto security',
    'phishing',
    'scam detection',
    'dotsama',
  ],
  authors: [{ name: 'Wisesama' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://wisesama.com',
    siteName: 'Wisesama',
    title: 'Wisesama - Polkadot Fraud Detection',
    description:
      'Detect crypto fraud, phishing, ransomware, and money laundering in the Polkadot/Dotsama ecosystem.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wisesama - Polkadot Fraud Detection',
    description:
      'Detect crypto fraud, phishing, ransomware, and money laundering in the Polkadot/Dotsama ecosystem.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Satoshi + Clash Display from FontShare */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-black min-h-screen flex flex-col">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
