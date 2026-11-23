import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/my-reports', '/login', '/register'],
    },
    sitemap: 'https://wisesama.com/sitemap.xml',
  };
}
