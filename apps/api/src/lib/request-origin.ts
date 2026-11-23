/** Exact application origins shared by CORS, authentication and session mutations. */
export function trustedApplicationOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const production = env.NODE_ENV === 'production';
  const origins = new Set<string>();
  const configured = [
    'https://wisesama.com',
    'https://www.wisesama.com',
    'https://admin.wisesama.com',
    'https://wisesama-admin.vercel.app',
    ...(!production
      ? ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003']
      : []),
    env.APP_URL,
    env.ADMIN_APP_URL,
    env.INTEL_APP_URL,
    ...(env.CORS_ORIGIN?.split(',') ?? []),
  ];
  for (const raw of configured) {
    if (!raw?.trim()) continue;
    try {
      const url = new URL(raw.trim());
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hostname.includes('*') ||
        (production &&
          (url.protocol !== 'https:' ||
            url.hostname === 'localhost' ||
            url.hostname.endsWith('.localhost') ||
            /^127\./.test(url.hostname) ||
            url.hostname === '[::1]'))
      )
        continue;
      origins.add(url.origin);
    } catch {
      // Invalid configured values never become wildcard or reflected trust.
    }
  }
  return [...origins];
}

type Headers = { origin?: string | string[]; 'content-type'?: string | string[] };
export function sessionMutationError(method: string, headers: Headers) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return null;
  if (typeof headers.origin !== 'string' || !trustedApplicationOrigins().includes(headers.origin))
    return { status: 403 as const, error: 'A trusted application origin is required.' };
  if (
    typeof headers['content-type'] !== 'string' ||
    !/^application\/json(?:\s*;|\s*$)/i.test(headers['content-type'])
  )
    return { status: 415 as const, error: 'Use application/json for this request.' };
  return null;
}
