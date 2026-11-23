-- Additive product context and repository configuration evidence. No existing data is moved.
ALTER TABLE "SecurityProject"
  ADD COLUMN "internetFacing" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "sensitiveData" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "hosting" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "contextUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ProjectRepositorySource"
  ADD COLUMN "baseline" JSONB,
  ADD COLUMN "baselineCheckedAt" TIMESTAMP(3),
  ADD COLUMN "baselineAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "baselineError" TEXT,
  ADD COLUMN "baselineToken" TEXT,
  ADD COLUMN "baselineStartedAt" TIMESTAMP(3);

CREATE TABLE "SecurityPlaybookResponse" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "playbookId" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'investigating',
  "answers" JSONB NOT NULL DEFAULT '{}',
  "checks" JSONB NOT NULL DEFAULT '{}',
  "note" TEXT NOT NULL DEFAULT '',
  "evidence" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "SecurityPlaybookResponse_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SecurityPlaybookEvent" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "evidence" TEXT NOT NULL DEFAULT '',
  "answers" JSONB NOT NULL DEFAULT '{}',
  "checks" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityPlaybookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SecurityPlaybookResponse_projectId_playbookId_key" ON "SecurityPlaybookResponse"("projectId", "playbookId");
CREATE INDEX "SecurityPlaybookResponse_userId_updatedAt_idx" ON "SecurityPlaybookResponse"("userId", "updatedAt");
CREATE INDEX "SecurityPlaybookEvent_responseId_createdAt_idx" ON "SecurityPlaybookEvent"("responseId", "createdAt");
ALTER TABLE "SecurityPlaybookResponse" ADD CONSTRAINT "SecurityPlaybookResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityPlaybookResponse" ADD CONSTRAINT "SecurityPlaybookResponse_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "SecurityProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityPlaybookEvent" ADD CONSTRAINT "SecurityPlaybookEvent_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SecurityPlaybookResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
