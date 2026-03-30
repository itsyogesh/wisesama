import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@wisesama/database';

// Build trusted origins list dynamically for Vercel preview support
const trustedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'https://wisesama.com',
  'https://www.wisesama.com',
  'https://admin.wisesama.com',
  'https://wisesama-admin.vercel.app',
  ...(process.env.APP_URL ? [process.env.APP_URL] : []),
  ...(process.env.ADMIN_APP_URL ? [process.env.ADMIN_APP_URL] : []),
  ...(process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'),
  emailAndPassword: { enabled: true },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      enabled: !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET),
    },
  },
  trustedOrigins,
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'USER',
        input: false,
      },
      tier: {
        type: 'string',
        defaultValue: 'free',
        input: false,
      },
      remainingQuota: {
        type: 'number',
        defaultValue: 100,
        input: false,
      },
      isVerified: {
        type: 'boolean',
        defaultValue: false,
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 min cache
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.NODE_ENV === 'production' ? '.wisesama.com' : undefined,
    },
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
});
