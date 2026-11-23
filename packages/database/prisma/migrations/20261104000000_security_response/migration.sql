-- Additive migration. Existing crypto data and tables are preserved.
CREATE TABLE "SecurityProject" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "packages" JSONB NOT NULL DEFAULT '[]',
  "runtime" JSONB,
  "inventoryRevision" TEXT NOT NULL,
  "inventoryUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastScannedAt" TIMESTAMP(3),
  "nextScanAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scanError" TEXT,
  "scanToken" TEXT,
  "scanStartedAt" TIMESTAMP(3),
  "sources" JSONB NOT NULL DEFAULT '[]',
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityProject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityProject_environment_check" CHECK ("environment" IN ('production', 'staging', 'development'))
);
CREATE TABLE "SecurityAdvisory" (
  "id" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "data" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityAdvisory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SecurityFinding" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "advisoryId" TEXT NOT NULL,
  "ecosystem" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "installedVersion" TEXT NOT NULL,
  "fixedVersion" TEXT,
  "riskSnapshot" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'open',
  "note" TEXT NOT NULL DEFAULT '',
  "evidence" TEXT NOT NULL DEFAULT '',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityFinding_status_check" CHECK ("status" IN ('open', 'investigating', 'mitigated', 'resolved', 'not_affected'))
);
CREATE TABLE "SecurityFindingEvent" (
  "id" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "actorId" TEXT,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "evidence" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityFindingEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SecurityNotificationSettings" (
  "userId" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecurityNotificationSettings_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "SecurityDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "eventKey" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecurityDelivery_status_check" CHECK ("status" IN ('pending', 'processing', 'sent', 'failed', 'unavailable', 'skipped'))
);
CREATE INDEX "SecurityProject_userId_createdAt_idx" ON "SecurityProject"("userId", "createdAt");
CREATE INDEX "SecurityProject_lastScannedAt_idx" ON "SecurityProject"("lastScannedAt");
CREATE UNIQUE INDEX "SecurityFinding_match_key" ON "SecurityFinding"("projectId", "advisoryId", "ecosystem", "packageName", "installedVersion");
CREATE INDEX "SecurityFinding_projectId_status_idx" ON "SecurityFinding"("projectId", "status");
CREATE INDEX "SecurityFindingEvent_findingId_createdAt_idx" ON "SecurityFindingEvent"("findingId", "createdAt");
CREATE UNIQUE INDEX "SecurityDelivery_eventKey_key" ON "SecurityDelivery"("eventKey");
CREATE INDEX "SecurityDelivery_userId_createdAt_idx" ON "SecurityDelivery"("userId", "createdAt");
CREATE INDEX "SecurityDelivery_status_nextAttemptAt_idx" ON "SecurityDelivery"("status", "nextAttemptAt");
ALTER TABLE "SecurityProject" ADD CONSTRAINT "SecurityProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SecurityProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "SecurityAdvisory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityFindingEvent" ADD CONSTRAINT "SecurityFindingEvent_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "SecurityFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityNotificationSettings" ADD CONSTRAINT "SecurityNotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityDelivery" ADD CONSTRAINT "SecurityDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityDelivery" ADD CONSTRAINT "SecurityDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SecurityProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
