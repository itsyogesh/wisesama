-- Provider credentials are application-encrypted. Associations are owner-checked in services.
CREATE TABLE "RepositoryConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "installationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'connected',
  "credentials" TEXT,
  "expiresAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "refreshLock" TEXT,
  "refreshStartedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RepositoryConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RepositoryConnection_owner_identity_installation_key" ON "RepositoryConnection"("userId", "provider", "providerUserId", "installationId");
CREATE INDEX "RepositoryConnection_userId_createdAt_idx" ON "RepositoryConnection"("userId", "createdAt");

CREATE TABLE "RepositoryConnectionAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "verifier" TEXT NOT NULL,
  "installationId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RepositoryConnectionAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RepositoryConnectionAttempt_stateHash_key" ON "RepositoryConnectionAttempt"("stateHash");
CREATE INDEX "RepositoryConnectionAttempt_expiresAt_idx" ON "RepositoryConnectionAttempt"("expiresAt");

CREATE TABLE "ProjectRepositorySource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "repositoryId" TEXT NOT NULL,
  "repositoryName" TEXT NOT NULL,
  "repositoryUrl" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "paths" TEXT[] NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'repository_inventory',
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "observedCommit" TEXT,
  "importedCommit" TEXT,
  "inventoryDigest" TEXT,
  "importedFiles" JSONB NOT NULL DEFAULT '[]',
  "lastSyncedAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "nextSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "syncToken" TEXT,
  "syncStartedAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectRepositorySource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjectRepositorySource_projectId_key" ON "ProjectRepositorySource"("projectId");
CREATE INDEX "ProjectRepositorySource_userId_createdAt_idx" ON "ProjectRepositorySource"("userId", "createdAt");
CREATE INDEX "ProjectRepositorySource_connectionId_idx" ON "ProjectRepositorySource"("connectionId");
CREATE INDEX "ProjectRepositorySource_provider_repositoryId_idx" ON "ProjectRepositorySource"("provider", "repositoryId");
CREATE INDEX "ProjectRepositorySource_paused_nextSyncAt_idx" ON "ProjectRepositorySource"("paused", "nextSyncAt");

CREATE TABLE "RepositoryWebhookDelivery" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "repositoryId" TEXT,
  "installationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "error" TEXT,
  CONSTRAINT "RepositoryWebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RepositoryWebhookDelivery_provider_deliveryId_key" ON "RepositoryWebhookDelivery"("provider", "deliveryId");
CREATE INDEX "RepositoryWebhookDelivery_status_receivedAt_idx" ON "RepositoryWebhookDelivery"("status", "receivedAt");
