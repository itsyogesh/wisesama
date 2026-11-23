-- Public opt-in subscriptions have no dependency on private account notifications.
CREATE TABLE "PublicSubscriber" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "topics" JSONB NOT NULL DEFAULT '["all"]',
  "confirmedAt" TIMESTAMP(3), "lastRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextDigestAt" TIMESTAMP(3), "lastCompiledAt" TIMESTAMP(3),
  "unsubscribeVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicSubscriber_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicSubscriber_status_check" CHECK ("status" IN ('pending', 'active', 'unsubscribed', 'suppressed'))
);
CREATE TABLE "PublicSubscriptionToken" (
  "id" TEXT NOT NULL, "subscriberId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL, "topics" JSONB, "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicSubscriptionToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicSubscriptionToken_purpose_check" CHECK ("purpose" IN ('confirm', 'manage'))
);
CREATE TABLE "PublicFeedState" (
  "advisoryId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicFeedState_pkey" PRIMARY KEY ("advisoryId")
);
CREATE TABLE "PublicFeedEvent" (
  "id" TEXT NOT NULL, "advisoryId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "data" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicFeedEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PublicFeedDelivery" (
  "id" TEXT NOT NULL, "subscriberId" TEXT NOT NULL, "eventKey" TEXT NOT NULL,
  "items" JSONB NOT NULL, "subject" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3), "providerMessageId" TEXT, "error" TEXT, "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicFeedDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublicFeedDelivery_status_check" CHECK ("status" IN ('pending', 'sent', 'failed', 'unavailable', 'skipped'))
);
CREATE TABLE "PublicMailWebhook" (
  "id" TEXT NOT NULL, "type" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicMailWebhook_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PublicMailReceipt" (
  "id" TEXT NOT NULL, "subscriberId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicMailReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicSubscriber_email_key" ON "PublicSubscriber"("email");
CREATE INDEX "PublicSubscriber_status_nextDigestAt_idx" ON "PublicSubscriber"("status", "nextDigestAt");
CREATE UNIQUE INDEX "PublicSubscriptionToken_tokenHash_key" ON "PublicSubscriptionToken"("tokenHash");
CREATE INDEX "PublicSubscriptionToken_subscriberId_purpose_createdAt_idx" ON "PublicSubscriptionToken"("subscriberId", "purpose", "createdAt");
CREATE INDEX "PublicSubscriptionToken_expiresAt_idx" ON "PublicSubscriptionToken"("expiresAt");
CREATE INDEX "PublicFeedEvent_createdAt_idx" ON "PublicFeedEvent"("createdAt");
CREATE UNIQUE INDEX "PublicFeedDelivery_eventKey_key" ON "PublicFeedDelivery"("eventKey");
CREATE UNIQUE INDEX "PublicFeedDelivery_providerMessageId_key" ON "PublicFeedDelivery"("providerMessageId");
CREATE INDEX "PublicFeedDelivery_status_nextAttemptAt_idx" ON "PublicFeedDelivery"("status", "nextAttemptAt");
CREATE INDEX "PublicFeedDelivery_subscriberId_createdAt_idx" ON "PublicFeedDelivery"("subscriberId", "createdAt");
ALTER TABLE "PublicSubscriptionToken" ADD CONSTRAINT "PublicSubscriptionToken_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "PublicSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicFeedDelivery" ADD CONSTRAINT "PublicFeedDelivery_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "PublicSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PublicMailReceipt_subscriberId_idx" ON "PublicMailReceipt"("subscriberId");
ALTER TABLE "PublicMailReceipt" ADD CONSTRAINT "PublicMailReceipt_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "PublicSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
