import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/admin', '/invite', '/subscribe/', '/sign-in', '/sign-up'],
    },
    sitemap: 'https://www.wisesama.com/sitemap.xml',
  };
}
