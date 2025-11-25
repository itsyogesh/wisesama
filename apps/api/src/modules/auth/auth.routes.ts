import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@wisesama/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/auth/register', {
    schema: {
      tags: ['auth'],
      description: 'Register a new user account',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
        required: ['email', 'password'],
      },
    },
    handler: async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid input', details: parsed.error.issues };
      }

      const { email, password } = parsed.data;

      // Check if user exists
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        reply.status(409);
        return { error: 'Email already registered' };
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      });

      // Generate token
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      reply.status(201);
      return {
        user: {
          id: user.id,
          email: user.email,
          tier: user.tier,
          remainingQuota: user.remainingQuota,
        },
        accessToken: token,
      };
    },
  });

  // Login
  fastify.post('/auth/login', {
    schema: {
      tags: ['auth'],
      description: 'Login to get access token',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
    },
    handler: async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid input', details: parsed.error.issues };
      }

      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.passwordHash) {
        reply.status(401);
        return { error: 'Invalid credentials' };
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        reply.status(401);
        return { error: 'Invalid credentials' };
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          tier: user.tier,
          remainingQuota: user.remainingQuota,
        },
        accessToken: token,
      };
    },
  });

  // Get current user
  fastify.get('/auth/me', {
    schema: {
      tags: ['auth'],
      description: 'Get current user profile',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const auth = request.headers.authorization;
      if (!auth?.startsWith('Bearer ')) {
        reply.status(401);
        return { error: 'Unauthorized' };
      }

      const token = auth.slice(7);
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            email: true,
            tier: true,
            remainingQuota: true,
            createdAt: true,
          },
        });

        if (!user) {
          reply.status(401);
          return { error: 'User not found' };
        }

        return { user };
      } catch {
        reply.status(401);
        return { error: 'Invalid token' };
      }
    },
  });
}
