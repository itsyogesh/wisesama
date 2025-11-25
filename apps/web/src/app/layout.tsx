import type { Metadata } from 'next';
import { Poppins, Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

const vietnamPro = Be_Vietnam_Pro({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-vietnam',
});

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
      <body className={`${poppins.variable} ${vietnamPro.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
