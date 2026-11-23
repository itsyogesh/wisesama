import type { MetadataRoute } from 'next';
import { publicPaths } from '../lib/public-routes';

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: `https://www.wisesama.com${path === '/' ? '' : path}`,
  }));
}
