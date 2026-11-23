import { prisma } from '@wisesama/database';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { sendAuthenticationEmail } from '../services/auth-email.service';
import { workspaceEmailConfigured } from '../services/brevo-email.service';
import { trustedApplicationOrigins } from './request-origin';

const trustedOrigins = trustedApplicationOrigins();
const production = process.env.NODE_ENV === 'production';
const shareCookies = production && process.env.BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES !== 'false';
const workspaceUrl = process.env.INTEL_APP_URL?.trim();
export const githubSignInAvailable = Boolean(
  process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim(),
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL:
    process.env.BETTER_AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001'),
  emailAndPassword: { enabled: true },
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      requireLocalEmailVerified: true,
      // Only explicit linking from a signed-in session may join different addresses.
      allowDifferentEmails: true,
    },
  },
  onAPIError: {
    errorURL: workspaceUrl ? new URL('/sign-in', workspaceUrl).href : undefined,
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (
        (context.path === '/sign-in/social' || context.path === '/link-social') &&
        context.body?.provider === 'github' &&
        context.body.scopes?.length
      ) {
        // Better Auth requests read:user and user:email by default. Repository access uses its own app.
        throw new APIError('BAD_REQUEST', {
          message: 'GitHub sign-in uses standard account access.',
        });
      }
    }),
  },
  emailVerification: {
    sendOnSignUp: workspaceEmailConfigured(),
    autoSignInAfterVerification: false,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthenticationEmail({ email: user.email, url });
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      enabled: githubSignInAvailable,
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
      enabled: false,
    },
  },
  advanced: {
    cookiePrefix: process.env.BETTER_AUTH_COOKIE_PREFIX,
    cookies: {
      // Keep the signed state cookie available for the same 10 minutes as the verification record.
      state: { attributes: { maxAge: 600 } },
    },
    crossSubDomainCookies: {
      enabled: shareCookies,
      domain: shareCookies ? '.wisesama.com' : undefined,
    },
    defaultCookieAttributes: {
      sameSite: production ? 'none' : 'lax',
      secure: production,
    },
  },
});
