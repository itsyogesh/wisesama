-- A signed bounce can arrive before its send receipt. Keep it pending until that receipt exists.
ALTER TABLE "PublicMailWebhook"
  ADD COLUMN "providerMessageId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processedAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;
-- Previously acknowledged feedback cannot be reconstructed. Treat old ledger entries as legacy.
UPDATE "PublicMailWebhook" SET "status" = 'legacy', "processedAt" = "createdAt";
CREATE INDEX "PublicMailWebhook_status_nextAttemptAt_idx" ON "PublicMailWebhook"("status", "nextAttemptAt");
CREATE INDEX "PublicMailWebhook_providerMessageId_idx" ON "PublicMailWebhook"("providerMessageId");
