import { prisma } from '@wisesama/database';
import type { ActivityType } from '@wisesama/types';

interface LogActivityParams {
  type: ActivityType;
  description: string;
  userId?: string;
  userEmail?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Log an activity for audit trail purposes.
 * This is designed to be called asynchronously (fire-and-forget)
 * so it doesn't block the main request flow.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        type: params.type,
        description: params.description,
        userId: params.userId,
        userEmail: params.userEmail,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata || {}) as object,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    // Log error but don't throw - activity logging should never break the main flow
    console.error('Failed to log activity:', error);
  }
}

/**
 * Log whitelist entity creation
 */
export function logWhitelistCreated(params: {
  entityId: string;
  entityName: string;
  adminId: string;
  adminEmail: string;
  ipAddress?: string;
}): Promise<void> {
  return logActivity({
    type: 'WHITELIST_CREATED',
    description: `Whitelist entity "${params.entityName}" created`,
    userId: params.adminId,
    userEmail: params.adminEmail,
    entityType: 'WhitelistedEntity',
    entityId: params.entityId,
    ipAddress: params.ipAddress,
  });
}

/**
 * Log whitelist entity update
 */
export function logWhitelistUpdated(params: {
  entityId: string;
  entityName: string;
  adminId: string;
  adminEmail: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  return logActivity({
    type: 'WHITELIST_UPDATED',
    description: `Whitelist entity "${params.entityName}" updated`,
    userId: params.adminId,
    userEmail: params.adminEmail,
    entityType: 'WhitelistedEntity',
    entityId: params.entityId,
    metadata: params.changes,
    ipAddress: params.ipAddress,
  });
}

/**
 * Log whitelist entity deletion
 */
export function logWhitelistDeleted(params: {
  entityId: string;
  entityName: string;
  adminId: string;
  adminEmail: string;
  ipAddress?: string;
}): Promise<void> {
  return logActivity({
    type: 'WHITELIST_DELETED',
    description: `Whitelist entity "${params.entityName}" deleted`,
    userId: params.adminId,
    userEmail: params.adminEmail,
    entityType: 'WhitelistedEntity',
    entityId: params.entityId,
    ipAddress: params.ipAddress,
  });
}

/**
 * Log report verification
 */
export function logReportVerified(params: {
  reportId: string;
  entityValue: string;
  adminId: string;
  adminEmail: string;
  addedToBlacklist: boolean;
  ipAddress?: string;
}): Promise<void> {
  return logActivity({
    type: 'REPORT_VERIFIED',
    description: `Report for "${params.entityValue}" verified`,
    userId: params.adminId,
    userEmail: params.adminEmail,
    entityType: 'Report',
    entityId: params.reportId,
    metadata: { addedToBlacklist: params.addedToBlacklist },
    ipAddress: params.ipAddress,
  });
}

/**
 * Log report rejection
 */
export function logReportRejected(params: {
  reportId: string;
  entityValue: string;
  adminId: string;
  adminEmail: string;
  reason: string;
  ipAddress?: string;
}): Promise<void> {
  return logActivity({
    type: 'REPORT_REJECTED',
    description: `Report for "${params.entityValue}" rejected: ${params.reason}`,
    userId: params.adminId,
    userEmail: params.adminEmail,
    entityType: 'Report',
    entityId: params.reportId,
    metadata: { reason: params.reason },
    ipAddress: params.ipAddress,
  });
}

/**
 * Log phishing sync completion
 */
export function logSyncCompleted(params: {
  sourceName: string;
  recordsProcessed: number;
  addressCount: number;
  domainCount: number;
}): Promise<void> {
  return logActivity({
    type: 'SYNC_COMPLETED',
    description: `Phishing sync from "${params.sourceName}" completed: ${params.recordsProcessed} records processed`,
    entityType: 'SyncState',
    metadata: {
      sourceName: params.sourceName,
      recordsProcessed: params.recordsProcessed,
      addressCount: params.addressCount,
      domainCount: params.domainCount,
    },
  });
}

/**
 * Log admin login
 */
export function logAdminLogin(params: {
  userId: string;
  userEmail: string;
  ipAddress?: string;
}): Promise<void> {
  return logActivity({
    type: 'ADMIN_LOGIN',
    description: `Admin login: ${params.userEmail}`,
    userId: params.userId,
    userEmail: params.userEmail,
    ipAddress: params.ipAddress,
  });
}
