import { type NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const target = new URL(request.url);
  const replacements: Record<string, string> = {
    '/terms-of-service': '/terms',
    '/privacy-policy': '/privacy',
    '/login': '/sign-in',
    '/register': '/sign-up',
  };
  const path = target.pathname.replace(/\/$/, '') || '/';
  if (replacements[path]) {
    target.pathname = replacements[path];
    return NextResponse.redirect(target, 301);
  }
  return new NextResponse(
    'This page has been retired. Visit https://www.wisesama.com/ for Wisesama security response.',
    {
      status: 410,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex',
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
}

export const config = {
  matcher: [
    '/developer/:path*',
    '/check/:path*',
    '/blog/:path*',
    '/blacklist/:path*',
    '/whitelist/:path*',
    '/whitelist-request/:path*',
    '/report/:path*',
    '/my-reports/:path*',
    '/dashboard/:path*',
    '/terms-of-service',
    '/privacy-policy',
    '/login',
    '/register',
  ],
};
