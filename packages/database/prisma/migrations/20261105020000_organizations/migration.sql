-- Additive organization hierarchy. Every existing user's projects remain isolated.
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "personalForUserId" TEXT,
  "createdById" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_personalForUserId_key" ON "Organization"("personalForUserId");
CREATE TABLE "OrganizationMember" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationMember_role_check" CHECK ("role" IN ('owner','admin','member'))
);
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId","userId");
CREATE INDEX "OrganizationMember_userId_createdAt_idx" ON "OrganizationMember"("userId","createdAt");
CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "acceptedById" TEXT,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationInvitation_role_check" CHECK ("role" IN ('admin','member')),
  CONSTRAINT "OrganizationInvitation_status_check" CHECK ("status" IN ('pending','accepted','revoked'))
);
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");
CREATE UNIQUE INDEX "OrganizationInvitation_organizationId_email_key" ON "OrganizationInvitation"("organizationId","email");
CREATE INDEX "OrganizationInvitation_organizationId_status_expiresAt_idx" ON "OrganizationInvitation"("organizationId","status","expiresAt");
CREATE TABLE "OrganizationAudit" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT,
  "targetUserId" TEXT,
  "targetInvitationId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationAudit_organizationId_createdAt_idx" ON "OrganizationAudit"("organizationId","createdAt");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_personalForUserId_fkey" FOREIGN KEY ("personalForUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationAudit" ADD CONSTRAINT "OrganizationAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationAudit" ADD CONSTRAINT "OrganizationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrganizationAudit" ADD CONSTRAINT "OrganizationAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Organization" ("id","name","personalForUserId","createdById","createdAt","updatedAt")
SELECT 'personal-' || md5("id"), LEFT(COALESCE(NULLIF(TRIM("name"),''),SPLIT_PART("email",'@',1),'Personal') || '''s workspace',80), "id", "id", "createdAt", CURRENT_TIMESTAMP FROM "User";
INSERT INTO "OrganizationMember" ("id","organizationId","userId","role","createdAt","updatedAt")
SELECT 'member-' || md5("id"), 'personal-' || md5("id"), "id", 'owner', "createdAt", CURRENT_TIMESTAMP FROM "User";
ALTER TABLE "SecurityProject" ADD COLUMN "organizationId" TEXT;
UPDATE "SecurityProject" SET "organizationId" = 'personal-' || md5("userId");
ALTER TABLE "SecurityProject" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "SecurityProject_organizationId_createdAt_idx" ON "SecurityProject"("organizationId","createdAt");
ALTER TABLE "SecurityProject" ADD CONSTRAINT "SecurityProject_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shared response history can attribute new actions. Existing history remains unknown.
ALTER TABLE "SecurityPlaybookEvent" ADD COLUMN "actorId" TEXT;
ALTER TABLE "SecurityPlaybookEvent" ADD CONSTRAINT "SecurityPlaybookEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
