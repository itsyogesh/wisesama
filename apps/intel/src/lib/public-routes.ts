import { publicGuides } from './public-content';

export const publicPaths = [
  '/',
  '/product',
  '/feed',
  '/agents',
  '/skills',
  '/guides',
  '/playbooks',
  '/playbooks/malicious-dependency',
  '/playbooks/cursor-extension-oct-2026',
  '/pricing',
  '/integrations/github',
  '/integrations/gitlab',
  '/security',
  '/privacy',
  '/terms',
  '/docs',
  '/docs/api',
  '/docs/rss',
  '/docs/mcp',
  ...publicGuides.map((guide) => `/guides/${guide.slug}`),
];

export function knownPage(path: string) {
  return (
    publicPaths.includes(path) ||
    [
      '/sign-in',
      '/sign-up',
      '/invite',
      '/subscribe/confirm',
      '/subscribe/manage',
      '/admin',
      '/app',
      '/notifications',
    ].includes(path) ||
    /^\/(?:app|admin|feed|briefings|projects|findings)\//.test(path) ||
    ['/briefings', '/projects'].includes(path)
  );
}
