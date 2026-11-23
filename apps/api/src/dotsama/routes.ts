import type { FastifyInstance } from 'fastify';
import { activityAdminRoutes } from './modules/admin/activity.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { contributionsRoutes } from './modules/admin/contributions.routes';
import { reportsAdminRoutes } from './modules/admin/reports.routes';
import { whitelistRoutes } from './modules/admin/whitelist.routes';
import { whitelistRequestsAdminRoutes } from './modules/admin/whitelist-requests.routes';
import { discordRoutes } from './modules/discord/discord.routes';
import { identityRoutes } from './modules/identity/identity.routes';
import { jobsRoutes } from './modules/jobs/jobs.routes';
import { checkRoutes } from './modules/query/check.routes';
import { reportRoutes } from './modules/report/report.routes';
import { statsRoutes } from './modules/stats/stats.routes';
import { telegramRoutes } from './modules/telegram/telegram.routes';
import { twitterRoutes } from './modules/twitter/twitter.routes';
import { whitelistRequestRoutes } from './modules/whitelist/request.routes';

/** Original crypto fraud product. The shared host supplies the existing /api/v1 prefix. */
export async function dotsamaRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(statsRoutes);
  await fastify.register(checkRoutes);
  await fastify.register(identityRoutes);
  await fastify.register(reportRoutes);
  await fastify.register(jobsRoutes);
  await fastify.register(telegramRoutes);
  await fastify.register(discordRoutes);
  await fastify.register(twitterRoutes);
  await fastify.register(whitelistRequestRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(whitelistRoutes);
  await fastify.register(reportsAdminRoutes);
  await fastify.register(contributionsRoutes);
  await fastify.register(whitelistRequestsAdminRoutes);
  await fastify.register(activityAdminRoutes);
}
