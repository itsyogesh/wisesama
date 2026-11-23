-- AlterTable
ALTER TABLE "User" ADD COLUMN     "intelAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intelRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "intelSuspendedAt" TIMESTAMP(3),
ADD COLUMN     "intelSuspensionReason" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "PublicSubscriber" ADD COLUMN     "adminRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IntelAdminAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelAdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelAdvisoryReview" (
    "advisoryId" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'published',
    "guidance" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "IntelAdvisoryReview_pkey" PRIMARY KEY ("advisoryId")
);

-- CreateTable
CREATE TABLE "IntelSourceControl" (
    "id" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "health" TEXT NOT NULL DEFAULT 'unknown',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelSourceControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelAdminJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "leaseToken" TEXT,
    "leaseStartedAt" TIMESTAMP(3),
    "error" TEXT,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelAdminJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelAdminJobAttempt" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "IntelAdminJobAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntelAdminAudit_targetType_targetId_createdAt_idx" ON "IntelAdminAudit"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelAdminAudit_actorId_createdAt_idx" ON "IntelAdminAudit"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "IntelAdminAudit_createdAt_idx" ON "IntelAdminAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntelAdminJob_activeKey_key" ON "IntelAdminJob"("activeKey");

-- CreateIndex
CREATE INDEX "IntelAdminJob_status_nextAttemptAt_idx" ON "IntelAdminJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IntelAdminJob_kind_targetId_createdAt_idx" ON "IntelAdminJob"("kind", "targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntelAdminJobAttempt_jobId_attempt_key" ON "IntelAdminJobAttempt"("jobId", "attempt");

-- AddForeignKey
ALTER TABLE "IntelAdminAudit" ADD CONSTRAINT "IntelAdminAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelAdvisoryReview" ADD CONSTRAINT "IntelAdvisoryReview_advisoryId_fkey" FOREIGN KEY ("advisoryId") REFERENCES "SecurityAdvisory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelAdminJobAttempt" ADD CONSTRAINT "IntelAdminJobAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntelAdminJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
