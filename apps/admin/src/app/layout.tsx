import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Wisesama Admin',
  description: 'Admin dashboard for Wisesama platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#2E2E2E',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
