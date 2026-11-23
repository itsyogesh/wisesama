-- Original schema from 9809c1d, before the additive Wisesama v2 migrations.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('SAFE', 'UNKNOWN', 'CAUTION', 'FRAUD');

-- CreateEnum
CREATE TYPE "ThreatCategory" AS ENUM ('PHISHING', 'SCAM', 'RUG_PULL', 'IMPERSONATION', 'FAKE_AIRDROP', 'RANSOMWARE', 'MIXER', 'OFAC_SANCTIONED', 'OTHER');

-- CreateEnum
CREATE TYPE "IdentitySource" AS ENUM ('POLKADOT_PEOPLE', 'KUSAMA_PEOPLE', 'KILT');

-- CreateEnum
CREATE TYPE "WhitelistRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('WHITELIST_CREATED', 'WHITELIST_UPDATED', 'WHITELIST_DELETED', 'REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'REPORT_VERIFIED', 'REPORT_REJECTED', 'SYNC_COMPLETED', 'ADMIN_LOGIN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "Chain" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ss58Prefix" INTEGER NOT NULL,
    "rpcEndpoint" TEXT,
    "explorerUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "chainId" INTEGER,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "riskScore" INTEGER,
    "threatCategory" "ThreatCategory",
    "source" TEXT NOT NULL DEFAULT 'unknown',
    "sourceUrl" TEXT,
    "threatName" TEXT,
    "timesSearched" INTEGER NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3),
    "userReportCount" INTEGER NOT NULL DEFAULT 0,
    "firstReportedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "source" "IdentitySource" NOT NULL,
    "chainId" INTEGER,
    "displayName" TEXT,
    "legalName" TEXT,
    "email" TEXT,
    "twitter" TEXT,
    "web" TEXT,
    "riot" TEXT,
    "github" TEXT,
    "discord" TEXT,
    "matrix" TEXT,
    "image" TEXT,
    "pgpFingerprint" TEXT,
    "additionalFields" JSONB NOT NULL DEFAULT '{}',
    "kiltDid" TEXT,
    "kiltCredentialUri" TEXT,
    "hasIdentity" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "judgements" JSONB NOT NULL DEFAULT '[]',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "remainingQuota" INTEGER NOT NULL DEFAULT 100,
    "tier" TEXT NOT NULL DEFAULT 'free',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "name" TEXT,
    "remainingQuota" INTEGER NOT NULL DEFAULT 10000,
    "rateLimitPerMin" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityId" TEXT,
    "reportedValue" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "threatCategory" "ThreatCategory" NOT NULL,
    "otherCategory" TEXT,
    "description" TEXT,
    "relatedUrl" TEXT,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityContribution" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "prStatus" TEXT NOT NULL DEFAULT 'pending',
    "entityType" "EntityType" NOT NULL,
    "entityValue" TEXT NOT NULL,
    "targetFile" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "searchTerm" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "userId" TEXT,
    "apiKeyUsed" TEXT,
    "resultRisk" "RiskLevel",
    "responseTimeMs" INTEGER,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchedAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'dot',
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityComment" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "authorName" TEXT,
    "authorEmail" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncHash" TEXT,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistedEntity" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "chainId" INTEGER,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "logoUrl" TEXT,
    "source" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhitelistedEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistRequest" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "chainId" INTEGER,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "logoUrl" TEXT,
    "userId" TEXT,
    "requesterName" TEXT,
    "requesterEmail" TEXT NOT NULL,
    "requesterOrg" TEXT,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationNotes" TEXT,
    "status" "WhitelistRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "whitelistedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhitelistRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chain_code_key" ON "Chain"("code");

-- CreateIndex
CREATE INDEX "Entity_normalizedValue_idx" ON "Entity"("normalizedValue");

-- CreateIndex
CREATE INDEX "Entity_riskLevel_idx" ON "Entity"("riskLevel");

-- CreateIndex
CREATE INDEX "Entity_source_idx" ON "Entity"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_entityType_normalizedValue_key" ON "Entity"("entityType", "normalizedValue");

-- CreateIndex
CREATE INDEX "Identity_address_idx" ON "Identity"("address");

-- CreateIndex
CREATE INDEX "Identity_source_idx" ON "Identity"("source");

-- CreateIndex
CREATE INDEX "Identity_isVerified_idx" ON "Identity"("isVerified");

-- CreateIndex
CREATE INDEX "Identity_twitter_idx" ON "Identity"("twitter");

-- CreateIndex
CREATE INDEX "Identity_web_idx" ON "Identity"("web");

-- CreateIndex
CREATE INDEX "Identity_twitter_isVerified_idx" ON "Identity"("twitter", "isVerified");

-- CreateIndex
CREATE INDEX "Identity_web_isVerified_idx" ON "Identity"("web", "isVerified");

-- CreateIndex
CREATE INDEX "Identity_github_idx" ON "Identity"("github");

-- CreateIndex
CREATE INDEX "Identity_github_isVerified_idx" ON "Identity"("github", "isVerified");

-- CreateIndex
CREATE INDEX "Identity_lastSyncedAt_idx" ON "Identity"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_address_source_key" ON "Identity"("address", "source");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_entityType_idx" ON "Report"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityContribution_reportId_key" ON "CommunityContribution"("reportId");

-- CreateIndex
CREATE INDEX "CommunityContribution_prStatus_idx" ON "CommunityContribution"("prStatus");

-- CreateIndex
CREATE INDEX "Search_searchedAt_idx" ON "Search"("searchedAt");

-- CreateIndex
CREATE INDEX "Search_normalizedTerm_idx" ON "Search"("normalizedTerm");

-- CreateIndex
CREATE INDEX "WatchedAddress_address_idx" ON "WatchedAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedAddress_userId_address_chain_key" ON "WatchedAddress"("userId", "address", "chain");

-- CreateIndex
CREATE INDEX "EntityComment_entityId_idx" ON "EntityComment"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_sourceName_key" ON "SyncState"("sourceName");

-- CreateIndex
CREATE INDEX "WhitelistedEntity_category_idx" ON "WhitelistedEntity"("category");

-- CreateIndex
CREATE INDEX "WhitelistedEntity_name_idx" ON "WhitelistedEntity"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistedEntity_entityType_normalizedValue_key" ON "WhitelistedEntity"("entityType", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistRequest_whitelistedEntityId_key" ON "WhitelistRequest"("whitelistedEntityId");

-- CreateIndex
CREATE INDEX "WhitelistRequest_status_idx" ON "WhitelistRequest"("status");

-- CreateIndex
CREATE INDEX "WhitelistRequest_userId_idx" ON "WhitelistRequest"("userId");

-- CreateIndex
CREATE INDEX "WhitelistRequest_requesterEmail_idx" ON "WhitelistRequest"("requesterEmail");

-- CreateIndex
CREATE INDEX "WhitelistRequest_createdAt_idx" ON "WhitelistRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_type_idx" ON "ActivityLog"("type");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityContribution" ADD CONSTRAINT "CommunityContribution_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchedAddress" ADD CONSTRAINT "WatchedAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityComment" ADD CONSTRAINT "EntityComment_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistedEntity" ADD CONSTRAINT "WhitelistedEntity_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistRequest" ADD CONSTRAINT "WhitelistRequest_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistRequest" ADD CONSTRAINT "WhitelistRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhitelistRequest" ADD CONSTRAINT "WhitelistRequest_whitelistedEntityId_fkey" FOREIGN KEY ("whitelistedEntityId") REFERENCES "WhitelistedEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

