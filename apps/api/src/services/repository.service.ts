import { randomUUID } from 'node:crypto';
import { type Prisma, type PrismaClient, prisma } from '@wisesama/database';
import { type BaselineSnapshot, normalizedBaselinePaths } from './intel/repository-baseline';
import { intelWorkspaceService } from './intel-workspace.service';
import {
  isActiveOrganizationMember,
  type ProjectAction,
  projectScope,
  requireOrganizationAccess,
  requireProjectAccess,
} from './organization-access';
import type { RepositoryProvider, RepositoryTokens } from './repository-provider';
import {
  decryptCredential,
  encryptCredential,
  encryptionKey,
  RepositoryError,
  randomSecret,
  repositoryProvider,
  stateHash,
  validateGithubWebhook,
  validateGitlabWebhook,
} from './repository-provider';

type Connection = Prisma.RepositoryConnectionGetPayload<Record<string, never>>;
type Source = Prisma.ProjectRepositorySourceGetPayload<Record<string, never>>;
type Selection = { repositoryId: string; branch: string; paths: string[] };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const safeConnection = (value: Connection) => ({
  id: value.id,
  provider: value.provider,
  accountName: value.accountName,
  installationId: value.installationId,
  installationAccountName: value.installationAccountName ?? null,
  repositorySelection: value.repositorySelection ?? null,
  status: value.status,
  error: value.error,
  validatedAt: value.validatedAt?.toISOString() ?? null,
  createdAt: value.createdAt.toISOString(),
});
const safeSource = (value: Source) => ({
  id: value.id,
  projectId: value.projectId,
  connectorUserId: value.userId,
  connectionId: value.connectionId,
  provider: value.provider,
  repositoryId: value.repositoryId,
  repositoryName: value.repositoryName,
  repositoryUrl: value.repositoryUrl,
  branch: value.branch,
  paths: value.paths,
  scope: value.scope,
  paused: value.paused,
  status: value.status,
  observedCommit: value.observedCommit,
  importedCommit: value.importedCommit,
  importedFiles: value.importedFiles,
  lastSyncedAt: value.lastSyncedAt?.toISOString() ?? null,
  lastAttemptAt: value.lastAttemptAt?.toISOString() ?? null,
  nextSyncAt: value.nextSyncAt.toISOString(),
  error: value.error,
});

export function createRepositoryService(
  options: {
    db?: PrismaClient;
    provider?: typeof repositoryProvider;
    env?: NodeJS.ProcessEnv;
    now?: () => Date;
    scan?: typeof intelWorkspaceService.scanProject;
  } = {},
) {
  const db = options.db ?? prisma;
  const provider = options.provider ?? repositoryProvider;
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const scan = options.scan ?? intelWorkspaceService.scanProject;
  const key = () => encryptionKey(env);
  const context = (userId: string, kind: string) => `wisesama:${userId}:${kind}`;
  const activeConnectorOwner = (organizationId: string): Prisma.UserWhereInput => ({
    intelSuspendedAt: null,
    organizationMemberships: {
      some: { organizationId, role: { in: ['owner', 'admin', 'member'] } },
    },
  });
  async function connection(userId: string, id: string, organizationId?: string) {
    const value = await db.repositoryConnection.findFirst({
      where: {
        id,
        userId,
        ...(organizationId ? { owner: activeConnectorOwner(organizationId) } : {}),
      },
    });
    if (!value) throw new RepositoryError(404, 'Repository connection not found.');
    if (value.status !== 'connected' || !value.credentials)
      throw new RepositoryError(409, 'This provider needs to be reconnected before importing.');
    return value;
  }
  async function source(userId: string, id: string, action: ProjectAction = 'read') {
    const value = await db.projectRepositorySource.findFirst({
      where: { id, project: projectScope(userId) },
    });
    if (!value) throw new RepositoryError(404, 'Repository source not found.');
    await requireProjectAccess(db, userId, value.projectId, action);
    return value;
  }
  async function assertConnector(
    userId: string,
    saved: Source,
    action: ProjectAction = 'read',
    accessDb: PrismaClient | Prisma.TransactionClient = db,
  ) {
    const project = await requireProjectAccess(accessDb, userId, saved.projectId, action);
    if (!(await isActiveOrganizationMember(accessDb, saved.userId, project.organizationId)))
      throw new RepositoryError(
        409,
        'The repository connector no longer has access to this organization. An organization admin must reconnect the source.',
      );
    return project;
  }
  function openTokens(value: Connection): RepositoryTokens {
    try {
      const tokens = JSON.parse(
        decryptCredential(value.credentials!, context(value.userId, value.provider), key()),
      ) as RepositoryTokens;
      if (!tokens.accessToken || typeof tokens.accessToken !== 'string') throw new Error('Token');
      return tokens;
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError(
        503,
        'Stored repository access is invalid. Reconnect the provider.',
      );
    }
  }
  async function tokens(
    value: Connection,
    beforeAccess?: () => Promise<unknown>,
  ): Promise<RepositoryTokens> {
    await beforeAccess?.();
    const current = openTokens(value);
    if (!value.expiresAt || value.expiresAt.getTime() > now().getTime() + 60_000) return current;
    if (!current.refreshToken)
      throw new RepositoryError(403, 'Provider authorization expired. Reconnect the provider.');
    const refreshLock = randomUUID();
    const claim = await db.repositoryConnection.updateMany({
      where: {
        id: value.id,
        userId: value.userId,
        status: 'connected',
        credentials: value.credentials,
        OR: [
          { refreshLock: null },
          { refreshStartedAt: { lt: new Date(now().getTime() - 60_000) } },
        ],
      },
      data: { refreshLock, refreshStartedAt: now() },
    });
    if (!claim.count)
      throw new RepositoryError(409, 'Provider access is refreshing. Try again in a moment.');
    try {
      await beforeAccess?.();
      const rotated = await provider.refresh(
        value.provider as RepositoryProvider,
        current.refreshToken,
      );
      if (!rotated.refreshToken)
        throw new RepositoryError(
          403,
          'The provider did not return replacement credentials. Reconnect.',
        );
      // Preserve an already-authorized rotation response so cancelling a source read
      // does not destroy the original owner’s personal refresh-token chain.
      // Every subsequent provider call is authorized again.
      const saved = await db.repositoryConnection.updateMany({
        where: { id: value.id, status: 'connected', refreshLock, credentials: value.credentials },
        data: {
          credentials: encryptCredential(
            JSON.stringify(rotated),
            context(value.userId, value.provider),
            key(),
          ),
          expiresAt: rotated.expiresAt ? new Date(rotated.expiresAt) : null,
          refreshLock: null,
          refreshStartedAt: null,
          error: null,
        },
      });
      if (!saved.count)
        throw new RepositoryError(
          409,
          'Provider access changed during refresh. Reconnect or try again.',
        );
      return rotated;
    } finally {
      await db.repositoryConnection.updateMany({
        where: { id: value.id, refreshLock },
        data: { refreshLock: null, refreshStartedAt: null },
      });
    }
  }
  async function authorized(
    userId: string,
    id: string,
    beforeAccess?: () => Promise<unknown>,
    organizationId?: string,
  ) {
    await beforeAccess?.();
    const value = await connection(userId, id, organizationId);
    try {
      const access = await tokens(value, beforeAccess);
      await beforeAccess?.();
      const identity = await provider.identity(
        value.provider as RepositoryProvider,
        access.accessToken,
        value.installationId ?? undefined,
      );
      if (identity.id !== value.providerUserId)
        throw new RepositoryError(403, 'The connected provider identity changed. Reconnect.');
      await db.repositoryConnection.updateMany({
        where: { id, userId, status: 'connected' },
        data: {
          validatedAt: now(),
          error: null,
          ...(value.provider === 'github' && {
            installationAccountName: identity.installationAccountName ?? null,
            repositorySelection: identity.repositorySelection ?? null,
          }),
        },
      });
      return { connection: value, token: access.accessToken, identity };
    } catch (error) {
      if (error instanceof RepositoryError && error.statusCode === 403) {
        await db.repositoryConnection.updateMany({
          where: { id, userId },
          data: { status: 'reconnect_required', error: error.message },
        });
      }
      throw error;
    }
  }
  async function selected(
    userId: string,
    id: string,
    repositoryId: string,
    beforeAccess?: () => Promise<unknown>,
    organizationId?: string,
  ) {
    const authorizedValue = await authorized(userId, id, beforeAccess, organizationId);
    const { connection: value, token } = authorizedValue;
    const kind = value.provider as RepositoryProvider;
    await beforeAccess?.();
    const repo = await provider.selected(
      kind,
      token,
      repositoryId,
      value.installationId ?? undefined,
    );
    await beforeAccess?.();
    const readToken = await provider.readToken(
      kind,
      token,
      repositoryId,
      value.installationId ?? undefined,
    );
    return { value, kind, repo, readToken };
  }
  async function listConnections(userId: string) {
    const values = await db.repositoryConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      providers: [provider.availability('github'), provider.availability('gitlab')],
      connections: values.map(safeConnection),
    };
  }
  async function start(userId: string, kind: RepositoryProvider, destination?: 'project') {
    if ((await db.repositoryConnection.count({ where: { userId, status: 'connected' } })) >= 20)
      throw new RepositoryError(409, 'This account has reached the 20-provider-connection limit.');
    // Check config before persisting attempts. No synthetic provider URL or successful connection.
    const state = destination === 'project' ? `project.${randomSecret()}` : randomSecret();
    const verifier = randomSecret();
    const authorizationUrl = provider.authorize(kind, state, verifier);
    await db.repositoryConnectionAttempt.create({
      data: {
        userId,
        provider: kind,
        stateHash: stateHash(state),
        verifier: encryptCredential(verifier, context(userId, `attempt:${kind}`), key()),
        expiresAt: new Date(now().getTime() + 10 * 60_000),
      },
    });
    return { authorizationUrl };
  }
  async function callback(
    userId: string,
    kind: RepositoryProvider,
    query: { state: string; code?: string; installationId?: string },
  ) {
    const attempt = await db.repositoryConnectionAttempt.findFirst({
      where: {
        userId,
        provider: kind,
        stateHash: stateHash(query.state),
        consumedAt: null,
        expiresAt: { gt: now() },
      },
    });
    if (!attempt)
      throw new RepositoryError(
        400,
        'This repository connection link expired or was already used. Start again.',
      );
    const verifier = decryptCredential(attempt.verifier, context(userId, `attempt:${kind}`), key());
    if (kind === 'github' && !query.code) {
      if (!query.installationId)
        throw new RepositoryError(400, 'A GitHub App installation is required.');
      const saved = await db.repositoryConnectionAttempt.updateMany({
        where: { id: attempt.id, consumedAt: null, expiresAt: { gt: now() } },
        data: { installationId: query.installationId },
      });
      if (!saved.count)
        throw new RepositoryError(400, 'This connection attempt expired. Start again.');
      return { redirect: provider.authorize(kind, query.state, verifier, true) };
    }
    if (!query.code)
      throw new RepositoryError(400, 'The provider did not return an authorization code.');
    const installationId = kind === 'github' ? attempt.installationId : null;
    if (kind === 'github' && !installationId)
      throw new RepositoryError(400, 'Complete the GitHub installation step first.');
    const claim = await db.repositoryConnectionAttempt.updateMany({
      where: { id: attempt.id, userId, consumedAt: null, expiresAt: { gt: now() } },
      data: { consumedAt: now() },
    });
    if (!claim.count) throw new RepositoryError(400, 'This connection attempt was already used.');
    const access = await provider.exchange(kind, query.code, verifier);
    const identity = await provider.identity(kind, access.accessToken, installationId ?? undefined);
    const credentials = encryptCredential(JSON.stringify(access), context(userId, kind), key());
    const existing = await db.repositoryConnection.findFirst({
      where: { userId, provider: kind, providerUserId: identity.id, installationId },
    });
    const data = {
      accountName: identity.name,
      installationAccountName: identity.installationAccountName ?? null,
      repositorySelection: identity.repositorySelection ?? null,
      credentials,
      expiresAt: access.expiresAt ? new Date(access.expiresAt) : null,
      validatedAt: now(),
      status: 'connected',
      error: null,
      refreshLock: null,
      refreshStartedAt: null,
    };
    const result = existing
      ? await db.repositoryConnection.update({ where: { id: existing.id }, data })
      : await db.repositoryConnection.create({
          data: { userId, provider: kind, providerUserId: identity.id, installationId, ...data },
        });
    return { connection: safeConnection(result) };
  }
  async function repositories(userId: string, id: string, page?: number) {
    const { connection: value, token, identity } = await authorized(userId, id);
    const result = await provider.list(
      value.provider as RepositoryProvider,
      token,
      value.installationId ?? undefined,
      page,
    );
    return {
      ...result,
      installationAccountName: identity.installationAccountName ?? null,
      repositorySelection: identity.repositorySelection ?? null,
    };
  }
  async function branches(userId: string, id: string, repositoryId: string) {
    const { kind, readToken, repo } = await selected(userId, id, repositoryId);
    return provider.branches(kind, readToken, repo);
  }
  async function discovery(userId: string, id: string, input: Omit<Selection, 'paths'>) {
    const { kind, readToken, repo } = await selected(userId, id, input.repositoryId);
    return provider.discover(kind, readToken, repo, input.branch);
  }
  async function preview(userId: string, id: string, input: Selection) {
    const { kind, readToken, repo } = await selected(userId, id, input.repositoryId);
    return provider.snapshot(kind, readToken, repo, input.branch, input.paths);
  }
  async function security(userId: string, projectId: string) {
    const project = await requireProjectAccess(db, userId, projectId);
    const saved = await db.projectRepositorySource.findFirst({
      where: { projectId, project: projectScope(userId) },
    });
    const snapshot = saved?.baseline as BaselineSnapshot | null | undefined;
    const available = Boolean(snapshot && Array.isArray(snapshot.checks));
    const stale =
      saved &&
      (saved.baselineError ||
        saved.paused ||
        saved.status !== 'current' ||
        saved.importedCommit !== snapshot?.commit ||
        !Array.isArray(snapshot?.inventoryPaths) ||
        JSON.stringify(normalizedBaselinePaths(saved.paths)) !==
          JSON.stringify(snapshot.inventoryPaths) ||
        (saved.observedCommit && saved.observedCommit !== snapshot?.commit));
    const tri = (value: string | undefined) =>
      value === 'yes' || value === 'no' ? value : 'unknown';
    return {
      project: {
        id: project.id,
        organizationId: project.organizationId,
        name: project.name,
        environment: project.environment,
      },
      context: {
        internetFacing: tri(project.internetFacing),
        sensitiveData: tri(project.sensitiveData),
        hosting: project.hosting ?? '',
        updatedAt: project.contextUpdatedAt?.toISOString() ?? null,
        provenance: 'self_reported' as const,
      },
      repository: saved
        ? {
            provider: saved.provider,
            connectorUserId: saved.userId,
            repositoryName: saved.repositoryName,
            branch: saved.branch,
            importedCommit: saved.importedCommit,
            observedCommit: saved.observedCommit,
            status: saved.status,
            paused: saved.paused,
            paths: saved.paths,
          }
        : null,
      baseline: {
        status: !saved
          ? 'unsupported'
          : available
            ? stale
              ? 'stale'
              : 'current'
            : saved.baselineError
              ? 'unavailable'
              : 'not_checked',
        commit: available ? snapshot!.commit : null,
        inventoryPaths:
          available && Array.isArray(snapshot?.inventoryPaths) ? snapshot.inventoryPaths : [],
        checkedAt: saved?.baselineCheckedAt?.toISOString() ?? null,
        attemptedAt: saved?.baselineAttemptedAt?.toISOString() ?? null,
        error: saved?.baselineError ?? null,
        checks: available ? snapshot!.checks : [],
        ciDependencies: available ? (snapshot?.ciDependencies ?? null) : null,
        scope: 'repository_configuration' as const,
        limitations: available
          ? snapshot!.limitations
          : [
              'Connect a repository and import an exact inventory to inspect configuration at the imported commit.',
              'Manual inventory does not provide repository configuration evidence.',
            ],
      },
    };
  }
  async function updateContext(
    userId: string,
    projectId: string,
    input: {
      internetFacing: 'yes' | 'no' | 'unknown';
      sensitiveData: 'yes' | 'no' | 'unknown';
      hosting: string;
    },
  ) {
    await requireProjectAccess(db, userId, projectId, 'contribute');
    const updated = await db.securityProject.updateMany({
      where: { id: projectId, ...projectScope(userId, 'contribute') },
      data: { ...input, contextUpdatedAt: now() },
    });
    if (!updated.count) throw new RepositoryError(404, 'Project not found.');
    return security(userId, projectId);
  }
  async function checkBaseline(userId: string, projectId: string) {
    const project = await requireProjectAccess(db, userId, projectId);
    const saved = await db.projectRepositorySource.findFirst({
      where: { projectId, project: projectScope(userId) },
    });
    if (
      !saved?.importedCommit ||
      saved.paused ||
      ['disconnected', 'access_removed'].includes(saved.status)
    )
      throw new RepositoryError(
        409,
        'Connect and sync an active repository source before checking its baseline.',
      );
    await assertConnector(userId, saved);
    const token = randomUUID();
    const claim = await db.projectRepositorySource.updateMany({
      where: {
        id: saved.id,
        userId: saved.userId,
        project: projectScope(userId),
        owner: activeConnectorOwner(project.organizationId),
        paused: false,
        importedCommit: saved.importedCommit,
        OR: [
          { baselineToken: null },
          { baselineStartedAt: { lt: new Date(now().getTime() - 5 * 60_000) } },
        ],
      },
      data: { baselineToken: token, baselineStartedAt: now(), baselineAttemptedAt: now() },
    });
    if (!claim.count)
      throw new RepositoryError(409, 'A repository baseline check is already running.');
    try {
      await assertConnector(userId, saved);
      const { kind, readToken, repo } = await selected(
        saved.userId,
        saved.connectionId,
        saved.repositoryId,
        () => assertConnector(userId, saved),
        project.organizationId,
      );
      await assertConnector(userId, saved);
      const snapshot = await provider.baseline(
        kind,
        readToken,
        repo,
        saved.importedCommit,
        saved.paths,
      );
      if (
        snapshot.commit !== saved.importedCommit ||
        !Array.isArray(snapshot.inventoryPaths) ||
        JSON.stringify(snapshot.inventoryPaths) !==
          JSON.stringify(normalizedBaselinePaths(saved.paths))
      )
        throw new RepositoryError(
          409,
          'Baseline commit or selected paths did not match the imported inventory.',
        );
      await assertConnector(userId, saved);
      const updated = await db.projectRepositorySource.updateMany({
        where: {
          id: saved.id,
          userId: saved.userId,
          project: projectScope(userId),
          owner: activeConnectorOwner(project.organizationId),
          baselineToken: token,
          paused: false,
          importedCommit: saved.importedCommit,
          branch: saved.branch,
          paths: { equals: saved.paths },
          connection: { status: 'connected' },
        },
        data: {
          baseline: json(snapshot),
          baselineCheckedAt: now(),
          baselineError: null,
          baselineToken: null,
          baselineStartedAt: null,
        },
      });
      if (!updated.count)
        throw new RepositoryError(
          409,
          'The repository source changed during the baseline check. Try again.',
        );
    } catch (error) {
      await db.projectRepositorySource.updateMany({
        where: { id: saved.id, userId: saved.userId, baselineToken: token },
        data: {
          baselineError:
            error instanceof RepositoryError
              ? error.message
              : 'The configuration check could not complete. Previous evidence is retained.',
          baselineToken: null,
          baselineStartedAt: null,
        },
      });
      throw error;
    }
    return security(userId, projectId);
  }
  async function collectBaseline(userId: string, projectId: string) {
    try {
      await checkBaseline(userId, projectId);
    } catch {
      /* Inventory and configuration collection have independent health. */
    }
  }
  async function createProject(
    userId: string,
    input: Selection & {
      organizationId: string;
      connectionId: string;
      name: string;
      environment: 'production' | 'staging' | 'development';
      expectedCommit?: string;
    },
  ) {
    await requireOrganizationAccess(db, userId, input.organizationId, 'manage');
    const snapshot = await preview(userId, input.connectionId, input);
    if (input.expectedCommit && input.expectedCommit !== snapshot.commit)
      throw new RepositoryError(
        409,
        'The repository changed since your preview. Review the latest inventory before creating the project.',
      );
    const value = await connection(userId, input.connectionId);
    const created = await db.$transaction(async (tx) => {
      await requireOrganizationAccess(tx, userId, input.organizationId, 'manage');
      if (
        (await tx.securityProject.count({ where: { organizationId: input.organizationId } })) >= 50
      )
        throw new RepositoryError(409, 'This organization has reached the 50-project limit.');
      const stillConnected = await tx.repositoryConnection.findFirst({
        where: { id: value.id, userId, status: 'connected' },
      });
      if (!stillConnected)
        throw new RepositoryError(409, 'The connection changed during import. Try again.');
      const project = await tx.securityProject.create({
        data: {
          userId,
          organizationId: input.organizationId,
          name: input.name,
          environment: input.environment,
          packages: json(snapshot.packages),
          warnings: json(snapshot.warnings),
          inventoryUpdatedAt: now(),
          nextScanAt: now(),
        },
      });
      const source = await tx.projectRepositorySource.create({
        data: {
          userId,
          projectId: project.id,
          connectionId: value.id,
          provider: value.provider,
          repositoryId: snapshot.repository.id,
          repositoryName: snapshot.repository.fullName,
          repositoryUrl: snapshot.repository.url,
          branch: input.branch,
          paths: input.paths,
          scope: snapshot.scope,
          status: 'current',
          observedCommit: snapshot.commit,
          importedCommit: snapshot.commit,
          inventoryDigest: snapshot.digest,
          importedFiles: json(snapshot.files),
          lastSyncedAt: now(),
          lastAttemptAt: now(),
          nextSyncAt: new Date(now().getTime() + 15 * 60_000),
        },
      });
      return { project, source };
    });
    // Inventory success and assessment success are deliberately independent.
    let assessment: Awaited<ReturnType<typeof scan>> | null = null;
    let assessmentError: string | null = null;
    try {
      assessment = await scan(userId, created.project.id);
    } catch {
      assessmentError =
        'The repository inventory was imported, but assessment did not complete. Run assessment from Projects.';
    }
    await collectBaseline(userId, created.project.id);
    return {
      project: {
        id: created.project.id,
        organizationId: created.project.organizationId,
        name: created.project.name,
      },
      source: safeSource(created.source),
      assessment,
      assessmentError,
      warnings: snapshot.warnings,
    };
  }
  async function listSources(userId: string, organizationId?: string) {
    if (organizationId) await requireOrganizationAccess(db, userId, organizationId);
    const values = await db.projectRepositorySource.findMany({
      where: { project: projectScope(userId, 'read', organizationId) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { project: { select: { lastScannedAt: true, scanError: true } } },
    });
    return {
      sources: values.map((value) => ({
        ...safeSource(value),
        lastAssessedAt: value.project?.lastScannedAt?.toISOString() ?? null,
        assessmentError: value.project?.scanError ?? null,
      })),
    };
  }
  async function synchronize(userId: string, id: string, action: ProjectAction) {
    const saved = await source(userId, id, action);
    const project = await assertConnector(userId, saved, action);
    if (saved.paused || saved.status === 'disconnected')
      throw new RepositoryError(409, 'Resume or reconnect this source before syncing.');
    const syncToken = randomUUID();
    const claim = await db.projectRepositorySource.updateMany({
      where: {
        id,
        userId: saved.userId,
        project: projectScope(userId, action),
        owner: activeConnectorOwner(project.organizationId),
        paused: false,
        status: { not: 'disconnected' },
        OR: [
          { syncToken: null },
          { syncStartedAt: { lt: new Date(now().getTime() - 10 * 60_000) } },
        ],
      },
      data: { syncToken, syncStartedAt: now(), status: 'syncing', lastAttemptAt: now() },
    });
    if (!claim.count) throw new RepositoryError(409, 'An inventory sync is already running.');
    try {
      await assertConnector(userId, saved, action);
      const selectedSource = await selected(
        saved.userId,
        saved.connectionId,
        saved.repositoryId,
        () => assertConnector(userId, saved, action),
        project.organizationId,
      );
      await assertConnector(userId, saved, action);
      const snapshot = await provider.snapshot(
        selectedSource.kind,
        selectedSource.readToken,
        selectedSource.repo,
        saved.branch,
        saved.paths,
      );
      await db.$transaction(async (tx) => {
        await assertConnector(userId, saved, action, tx);
        const stillConnected = await tx.repositoryConnection.findFirst({
          where: { id: saved.connectionId, userId: saved.userId, status: 'connected' },
        });
        if (!stillConnected)
          throw new RepositoryError(409, 'The provider was disconnected during sync.');
        const applied = await tx.projectRepositorySource.updateMany({
          where: {
            id,
            userId: saved.userId,
            project: projectScope(userId, action),
            owner: activeConnectorOwner(project.organizationId),
            syncToken,
            paused: false,
            branch: saved.branch,
            paths: { equals: saved.paths },
          },
          data: {
            observedCommit: snapshot.commit,
            importedCommit: snapshot.commit,
            inventoryDigest: snapshot.digest,
            importedFiles: json(snapshot.files),
            lastSyncedAt: now(),
            nextSyncAt: new Date(now().getTime() + 15 * 60_000),
            status: 'current',
            error: null,
            syncToken: null,
            syncStartedAt: null,
          },
        });
        if (!applied.count)
          throw new RepositoryError(409, 'The repository source changed during sync. Try again.');
        const currentProject = await tx.securityProject.findFirst({
          where: { id: saved.projectId, ...projectScope(userId, action) },
          select: { packages: true },
        });
        if (!currentProject) throw new RepositoryError(404, 'The project is no longer available.');
        if (
          snapshot.digest !== saved.inventoryDigest ||
          JSON.stringify(currentProject.packages) !== JSON.stringify(snapshot.packages)
        ) {
          const updated = await tx.securityProject.updateMany({
            where: { id: saved.projectId, ...projectScope(userId, action) },
            data: {
              packages: json(snapshot.packages),
              warnings: json(snapshot.warnings),
              inventoryRevision: randomUUID(),
              inventoryUpdatedAt: now(),
              nextScanAt: now(),
              scanError: null,
            },
          });
          if (!updated.count) throw new RepositoryError(404, 'The project is no longer available.');
        }
      });
      // Advisory freshness changes independently of the repository SHA.
      let assessmentError: string | null = null;
      try {
        await scan(userId, saved.projectId);
      } catch {
        assessmentError =
          'Inventory synced; assessment did not complete. Retry assessment from Projects.';
      }
      await collectBaseline(userId, saved.projectId);
      return { source: safeSource(await source(userId, id)), assessmentError };
    } catch (error) {
      const safeError =
        error instanceof RepositoryError
          ? error.message
          : 'Repository sync failed. The previous inventory is retained.';
      await db.projectRepositorySource.updateMany({
        where: { id, userId: saved.userId, syncToken },
        data: {
          status: 'failed',
          error: safeError,
          nextSyncAt: new Date(now().getTime() + 15 * 60_000),
          syncToken: null,
          syncStartedAt: null,
        },
      });
      throw error;
    } finally {
      await db.projectRepositorySource.updateMany({
        where: { id, userId: saved.userId, syncToken },
        data: { syncToken: null, syncStartedAt: null },
      });
    }
  }
  async function sync(userId: string, id: string) {
    return synchronize(userId, id, 'manage');
  }
  /** Jobs may only refresh the existing selection as its still-active original connector. */
  async function syncForJob(id: string) {
    const saved = await db.projectRepositorySource.findFirst({
      where: { id },
      select: { userId: true },
    });
    if (!saved) throw new RepositoryError(404, 'Repository source not found.');
    return synchronize(saved.userId, id, 'read');
  }
  async function updateSource(
    userId: string,
    id: string,
    input: { paused?: boolean; branch?: string; paths?: string[] },
  ) {
    const saved = await source(userId, id, 'manage');
    if (input.branch !== undefined || input.paths !== undefined) {
      if (saved.userId !== userId)
        throw new RepositoryError(
          403,
          'Only the original connector can choose new repository branches or inventory paths. Detach and reconnect with your own provider connection to replace it.',
        );
      await assertConnector(userId, saved, 'manage');
      const branch = input.branch ?? saved.branch,
        paths = input.paths ?? saved.paths;
      // Validate the exact proposed selection before replacing a valid configuration.
      await preview(userId, saved.connectionId, {
        repositoryId: saved.repositoryId,
        branch,
        paths,
      });
      await assertConnector(userId, saved, 'manage');
      await db.projectRepositorySource.updateMany({
        where: { id, project: projectScope(userId, 'manage'), userId: saved.userId },
        data: {
          branch,
          paths,
          baselineToken: null,
          baselineStartedAt: null,
          status: 'behind',
          syncToken: null,
          syncStartedAt: null,
          nextSyncAt: now(),
          error: null,
        },
      });
    }
    if (input.paused !== undefined) {
      if (!input.paused) {
        await assertConnector(userId, saved, 'manage');
        await connection(saved.userId, saved.connectionId);
      }
      await db.projectRepositorySource.updateMany({
        where: { id, project: projectScope(userId, 'manage'), userId: saved.userId },
        data: {
          paused: input.paused,
          baselineToken: null,
          baselineStartedAt: null,
          status: input.paused ? 'paused' : 'behind',
          syncToken: null,
          syncStartedAt: null,
          nextSyncAt: now(),
        },
      });
    }
    return { source: safeSource(await source(userId, id)) };
  }
  async function disconnectSource(userId: string, id: string) {
    const saved = await source(userId, id, 'manage');
    await db.projectRepositorySource.updateMany({
      where: { id, project: projectScope(userId, 'manage'), userId: saved.userId },
      data: {
        status: 'disconnected',
        baselineToken: null,
        baselineStartedAt: null,
        paused: true,
        inventoryDigest: null,
        syncToken: null,
        syncStartedAt: null,
        error:
          'Repository detached. The last imported inventory and response history are retained.',
      },
    });
    return { source: safeSource(await source(userId, id)) };
  }
  async function disconnect(userId: string, id: string) {
    const value = await db.repositoryConnection.findFirst({ where: { id, userId } });
    if (!value) throw new RepositoryError(404, 'Repository connection not found.');
    await db.$transaction(async (tx) => {
      await tx.repositoryConnection.updateMany({
        where: { id, userId },
        data: {
          status: 'disconnected',
          credentials: null,
          expiresAt: null,
          refreshLock: null,
          refreshStartedAt: null,
          error: null,
        },
      });
      await tx.projectRepositorySource.updateMany({
        where: { userId, connectionId: id },
        data: {
          paused: true,
          baselineToken: null,
          baselineStartedAt: null,
          status: 'disconnected',
          inventoryDigest: null,
          syncToken: null,
          syncStartedAt: null,
          error:
            'Provider disconnected. The last imported inventory and response history are retained.',
        },
      });
    });
    return {
      disconnected: true,
      message:
        'Wisesama credentials were removed. You can also uninstall or revoke the app in provider settings.',
    };
  }
  async function runScheduledSyncs(limit = 3) {
    const values = await db.projectRepositorySource.findMany({
      where: {
        paused: false,
        status: { not: 'disconnected' },
        nextSyncAt: { lte: now() },
        owner: { intelSuspendedAt: null },
      },
      orderBy: { nextSyncAt: 'asc' },
      take: Math.max(1, Math.min(limit, 10)),
    });
    const results = [];
    for (const value of values) {
      try {
        await syncForJob(value.id);
        results.push({ id: value.id, status: 'synced' });
      } catch (error) {
        results.push({
          id: value.id,
          status: 'failed',
          error: error instanceof RepositoryError ? error.message : 'Repository sync failed.',
        });
      }
    }
    // Expired attempts have no useful bearer secrets; bound storage growth.
    await db.repositoryConnectionAttempt.deleteMany({
      where: { expiresAt: { lt: new Date(now().getTime() - 24 * 60 * 60_000) } },
    });
    return { results };
  }
  async function webhook(
    kind: RepositoryProvider,
    raw: string,
    headers: Record<string, string | undefined>,
  ) {
    const deliveryId = kind === 'github' ? headers['x-github-delivery'] : headers['webhook-id'];
    const event = kind === 'github' ? headers['x-github-event'] : headers['x-gitlab-event'];
    if (!deliveryId || !/^[a-zA-Z0-9._:-]{1,150}$/.test(deliveryId) || !event || event.length > 100)
      throw new RepositoryError(400, 'Required webhook identifiers are missing.');
    const valid =
      kind === 'github'
        ? validateGithubWebhook(
            raw,
            headers['x-hub-signature-256'] ?? '',
            env.GITHUB_APP_WEBHOOK_SECRET ?? '',
          )
        : validateGitlabWebhook(
            raw,
            {
              id: deliveryId,
              timestamp: headers['webhook-timestamp'] ?? '',
              signature: headers['webhook-signature'] ?? '',
            },
            env.GITLAB_WEBHOOK_SIGNING_SECRET ?? '',
            now(),
          );
    if (!valid) throw new RepositoryError(401, 'Invalid repository webhook signature.');
    let payload: {
      action?: string;
      installation?: { id?: number };
      repository?: { id?: number };
      project?: { id?: number };
      sender?: { id?: number };
      ref?: string;
    };
    try {
      payload = JSON.parse(raw) as typeof payload;
    } catch {
      throw new RepositoryError(400, 'Invalid webhook JSON.');
    }
    const repositoryId = payload.repository?.id ?? payload.project?.id;
    const installationId = payload.installation?.id;
    const safeRepo =
      typeof repositoryId === 'number' && Number.isSafeInteger(repositoryId)
        ? String(repositoryId)
        : null;
    const safeInstallation =
      typeof installationId === 'number' && Number.isSafeInteger(installationId)
        ? String(installationId)
        : null;
    const duplicate = await db.$transaction(async (tx) => {
      const recordId = randomUUID();
      const recorded = await tx.repositoryWebhookDelivery.createMany({
        data: {
          id: recordId,
          provider: kind,
          deliveryId,
          event,
          repositoryId: safeRepo,
          installationId: safeInstallation,
        },
        skipDuplicates: true,
      });
      if (!recorded.count) return true;
      const authorizationRevoked =
        kind === 'github' &&
        event === 'github_app_authorization' &&
        payload.action === 'revoked' &&
        typeof payload.sender?.id === 'number' &&
        Number.isSafeInteger(payload.sender.id);
      const installationGone =
        kind === 'github' &&
        event === 'installation' &&
        ['deleted', 'suspend'].includes(payload.action ?? '') &&
        safeInstallation;
      if (authorizationRevoked) {
        const providerUserId = String(payload.sender!.id);
        const affected = await tx.repositoryConnection.findMany({
          where: { provider: kind, providerUserId },
          select: { id: true },
        });
        await tx.repositoryConnection.updateMany({
          where: { provider: kind, providerUserId },
          data: {
            status: 'access_removed',
            credentials: null,
            expiresAt: null,
            refreshLock: null,
            refreshStartedAt: null,
            error: 'GitHub user authorization was revoked. Reconnect the provider.',
          },
        });
        await tx.projectRepositorySource.updateMany({
          where: { connectionId: { in: affected.map((item) => item.id) } },
          data: {
            status: 'access_removed',
            paused: true,
            syncToken: null,
            syncStartedAt: null,
            error: 'GitHub user authorization was revoked. Previous inventory is retained.',
          },
        });
      } else if (installationGone) {
        const state = payload.action === 'suspend' ? 'suspended' : 'access_removed';
        const affected = await tx.repositoryConnection.findMany({
          where: { provider: kind, installationId: safeInstallation },
          select: { id: true },
        });
        await tx.repositoryConnection.updateMany({
          where: { provider: kind, installationId: safeInstallation },
          data: {
            status: state,
            ...(payload.action === 'deleted' ? { credentials: null, expiresAt: null } : {}),
            error: 'GitHub installation access is unavailable. Reconnect or update access.',
          },
        });
        await tx.projectRepositorySource.updateMany({
          where: { connectionId: { in: affected.map((item) => item.id) } },
          data: {
            status: 'access_removed',
            paused: true,
            syncToken: null,
            syncStartedAt: null,
            error:
              'GitHub installation access was removed or suspended. Previous inventory is retained.',
          },
        });
      } else if (safeRepo && (event === 'push' || event === 'Push Hook')) {
        // Reconcile the latest branch tip; never trust the webhook's commit or run its contents.
        const branch =
          typeof payload.ref === 'string' && payload.ref.startsWith('refs/heads/')
            ? payload.ref.slice(11)
            : null;
        if (branch)
          await tx.projectRepositorySource.updateMany({
            where: {
              provider: kind,
              repositoryId: safeRepo,
              paused: false,
              branch,
              status: { not: 'disconnected' },
            },
            data: { nextSyncAt: now() },
          });
      } else if (kind === 'github' && safeInstallation && event === 'installation_repositories') {
        const connections = await tx.repositoryConnection.findMany({
          where: { provider: kind, installationId: safeInstallation },
          select: { id: true },
        });
        await tx.projectRepositorySource.updateMany({
          where: { connectionId: { in: connections.map((item) => item.id) }, paused: false },
          data: { nextSyncAt: now() },
        });
      }
      await tx.repositoryWebhookDelivery.update({
        where: { id: recordId },
        data: { status: 'processed', processedAt: now() },
      });
      return false;
    });
    return { accepted: true, duplicate };
  }
  return {
    listConnections,
    start,
    callback,
    repositories,
    branches,
    discovery,
    preview,
    createProject,
    listSources,
    sync,
    syncForJob,
    updateSource,
    disconnectSource,
    disconnect,
    runScheduledSyncs,
    webhook,
    security,
    updateContext,
    checkBaseline,
  };
}

export const repositoryService = createRepositoryService();
