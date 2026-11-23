/** Local-only UI verification server: real auth/routes/storage, disposable database, no email. */
import { randomBytes } from 'node:crypto';

const database = process.env.INTEL_TEST_DATABASE_URL;
if (!database)
  throw new Error('Set INTEL_TEST_DATABASE_URL to an isolated local wisesama_intel database.');
const parsed = new URL(database);
if (
  !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
  !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
  parsed.pathname !== '/wisesama_intel' ||
  parsed.searchParams.has('host') ||
  parsed.searchParams.has('socket')
) {
  throw new Error('This preview accepts only the disposable local wisesama_intel database.');
}
process.env.DATABASE_URL = database;
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
process.env.BETTER_AUTH_URL = 'http://localhost:3001';
process.env.INTEL_APP_URL = 'http://localhost:3003';
delete process.env.RESEND_API_KEY;

const [
  { default: Fastify },
  { default: cors },
  { default: FastifyBetterAuth },
  { auth },
  { intelRoutes },
  { organizationRoutes },
  { intelAdminRoutes },
  { adminOpsRoutes },
  { playbookRoutes },
  { repositoryRoutes, createRepositoryRoutes },
  { securityBaselineRoutes, createSecurityBaselineRoutes },
  { publicSubscriptionRoutes },
  { mcpRoutes },
  { createRemediationRoutes },
  { createRemediationService },
  { default: rawBody },
] = await Promise.all([
  import('fastify'),
  import('@fastify/cors'),
  import('fastify-better-auth'),
  import('../src/lib/auth'),
  import('../src/modules/intel/intel.routes'),
  import('../src/modules/intel/organization.routes'),
  import('../src/modules/intel/admin.routes'),
  import('../src/modules/intel/admin-ops.routes'),
  import('../src/modules/intel/playbook.routes'),
  import('../src/modules/intel/repository.routes'),
  import('../src/modules/intel/security-baseline.routes'),
  import('../src/modules/intel/public-subscription.routes'),
  import('../src/modules/intel/mcp.routes'),
  import('../src/modules/intel/remediation.routes'),
  import('../src/services/remediation.service'),
  import('fastify-raw-body'),
]);
const ciPreview = process.env.INTEL_CI_PREVIEW === '1';
const ciService = ciPreview
  ? await (await import('./ci-preview-provider')).createCiPreviewRepositoryService()
  : null;
const app = Fastify({ logger: false });
await app.register(cors, { origin: 'http://localhost:3003', credentials: true });
await app.register(rawBody, { field: 'rawBody', global: false, runFirst: true });
await app.register(FastifyBetterAuth, { auth } as Parameters<typeof FastifyBetterAuth>[1]);
app.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Wisesama-Local-Preview', 'disposable-wisesama_intel');
  if (ciPreview) reply.header('X-Wisesama-CI-Preview', 'synthetic-immutable-repositories');
  if (
    reply.statusCode >= 200 &&
    reply.statusCode < 300 &&
    typeof payload === 'string' &&
    !request.url.startsWith('/api/auth') &&
    !request.url.startsWith('/api/v1/mcp')
  ) {
    try {
      return JSON.stringify({ data: JSON.parse(payload), meta: { requestId: request.id } });
    } catch {
      /* RSS is not JSON. */
    }
  }
  return payload;
});
await app.register(intelRoutes, { prefix: '/api/v1' });
await app.register(organizationRoutes, { prefix: '/api/v1' });
await app.register(
  createRemediationRoutes(
    ciService
      ? {
          service: createRemediationService({
            sync: ciService.sync,
            provider: {
              scan: async () => {
                const { readCiPreviewControl } = await import('./ci-preview-provider');
                const control = await readCiPreviewControl();
                return {
                  matches: [],
                  warnings: control.failBaseline ? ['Synthetic source unavailable.'] : [],
                  sources: [
                    {
                      name: 'OSV',
                      status: control.failBaseline
                        ? ('unavailable' as const)
                        : ('healthy' as const),
                      checkedAt: new Date().toISOString(),
                    },
                  ],
                  scannedAt: new Date().toISOString(),
                };
              },
            },
          }),
        }
      : {},
  ),
  { prefix: '/api/v1' },
);
await app.register(intelAdminRoutes, { prefix: '/api/v1' });
await app.register(adminOpsRoutes, { prefix: '/api/v1' });
await app.register(playbookRoutes, { prefix: '/api/v1' });
await app.register(ciService ? createRepositoryRoutes({ service: ciService }) : repositoryRoutes, {
  prefix: '/api/v1',
});
await app.register(
  ciService ? createSecurityBaselineRoutes({ service: ciService }) : securityBaselineRoutes,
  { prefix: '/api/v1' },
);
await app.register(publicSubscriptionRoutes, { prefix: '/api/v1' });
await app.register(mcpRoutes, { prefix: '/api/v1' });
await app.listen({ host: '127.0.0.1', port: 3001 });
console.log(
  ciPreview
    ? 'Local verification API listening on http://localhost:3001. Synthetic immutable CI transport; email disabled.'
    : 'Local verification API listening on http://localhost:3001. Real advisory providers; email disabled.',
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
