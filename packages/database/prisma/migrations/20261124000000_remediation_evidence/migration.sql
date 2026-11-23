ALTER TABLE "SecurityFinding" ADD COLUMN "remediation" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SecurityFinding" ADD COLUMN "remediationRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SecurityFindingEvent" ADD COLUMN "remediation" JSONB;
