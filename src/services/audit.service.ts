import { collection, addDoc, query, where, orderBy, getDocs, limit as firestoreLimit, writeBatch } from '@/config/firestore.compat';
import { db } from '@/config/firebase.config';

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: 'household' | 'shift' | 'member' | 'invitation' | 'subscription' | 'account';
  resourceId: string;
  changes?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
}

/** TTL for audit logs — 90 days */
const AUDIT_LOG_TTL_DAYS = 90;
/** TTL for security events — 365 days */
const SECURITY_EVENT_TTL_DAYS = 365;
/** Max audit docs to return in any query */
const MAX_AUDIT_RESULTS = 200;

/**
 * Audit Service - Logs all sensitive operations for security and compliance
 */
class AuditService {
  private readonly collection = 'auditLogs';

  /**
   * Log a security-sensitive action
   */
  async logAction(
    userId: string,
    action: string,
    resourceType: AuditLog['resourceType'],
    resourceId: string,
    changes?: Record<string, any>,
  ): Promise<void> {
    try {
      const auditLog: Omit<AuditLog, 'id'> = {
        userId,
        action,
        resourceType,
        resourceId,
        changes,
        timestamp: new Date(),
      };

      await addDoc(collection(db, this.collection), auditLog);
    } catch (error) {
      console.error('Failed to log audit action:', error);
      // Don't throw - audit logging failures shouldn't break functionality
    }
  }

  /**
   * Get user's audit logs (server-side limited)
   */
  async getUserAuditLogs(userId: string, maxResults: number = 50): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        firestoreLimit(Math.min(maxResults, MAX_AUDIT_RESULTS))
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate?.() || new Date(),
      })) as AuditLog[];
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }
  }

  /**
   * Get resource's audit logs (all changes to a specific resource)
   */
  async getResourceAuditLogs(resourceType: string, resourceId: string): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('resourceType', '==', resourceType),
        where('resourceId', '==', resourceId),
        orderBy('timestamp', 'desc'),
        firestoreLimit(MAX_AUDIT_RESULTS)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate?.() || new Date(),
      })) as AuditLog[];
    } catch (error) {
      console.error('Failed to fetch resource audit logs:', error);
      return [];
    }
  }

  /**
   * Get all actions in a household (admin view, server-side limited)
   */
  async getHouseholdAuditLogs(householdId: string, maxResults: number = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('resourceId', '==', householdId),
        orderBy('timestamp', 'desc'),
        firestoreLimit(Math.min(maxResults, MAX_AUDIT_RESULTS))
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        timestamp: docSnap.data().timestamp?.toDate?.() || new Date(),
      })) as AuditLog[];
    } catch (error) {
      console.error('Failed to fetch household audit logs:', error);
      return [];
    }
  }

  /**
   * Log household-specific actions
   */
  async logHouseholdAction(
    householdId: string,
    userId: string,
    action: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.logAction(userId, action, 'household', householdId, details);
    } catch (error) {
      console.error('Failed to log household action:', error);
    }
  }

  /**
   * Log critical security event
   */
  async logSecurityEvent(
    userId: string,
    eventType: string,
    details: Record<string, any>,
  ): Promise<void> {
    try {
      const securityLog = {
        userId,
        eventType,
        details,
        timestamp: new Date(),
        severity: 'HIGH',
      };

      await addDoc(collection(db, 'securityEvents'), securityLog);

      console.warn(`⚠️ SECURITY EVENT: ${eventType} by ${userId}`, details);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // =========================================================================
  // DATA RETENTION / TTL CLEANUP
  // =========================================================================

  /**
   * Purge audit logs older than AUDIT_LOG_TTL_DAYS (90 days).
   * Call on app start or periodically in the background.
   * Returns the number of documents deleted.
   */
  async cleanupExpiredAuditLogs(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - AUDIT_LOG_TTL_DAYS);

      const expiredQuery = query(
        collection(db, this.collection),
        where('timestamp', '<', cutoffDate),
        firestoreLimit(500) // Process at most 500 per run to avoid timeout
      );

      const snapshot = await getDocs(expiredQuery);
      if (snapshot.empty) return 0;

      const BATCH_LIMIT = 499;
      let deletedCount = 0;

      for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
        const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deletedCount += chunk.length;
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Purged ${deletedCount} expired audit logs (>${AUDIT_LOG_TTL_DAYS}d)`);
      }
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired audit logs:', error);
      return 0;
    }
  }

  /**
   * Purge security events older than SECURITY_EVENT_TTL_DAYS (365 days).
   */
  async cleanupExpiredSecurityEvents(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - SECURITY_EVENT_TTL_DAYS);

      const expiredQuery = query(
        collection(db, 'securityEvents'),
        where('timestamp', '<', cutoffDate),
        firestoreLimit(500)
      );

      const snapshot = await getDocs(expiredQuery);
      if (snapshot.empty) return 0;

      const BATCH_LIMIT = 499;
      let deletedCount = 0;

      for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
        const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deletedCount += chunk.length;
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Purged ${deletedCount} expired security events (>${SECURITY_EVENT_TTL_DAYS}d)`);
      }
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired security events:', error);
      return 0;
    }
  }

  /**
   * Run all TTL cleanup jobs. Call on app start.
   */
  async runRetentionCleanup(): Promise<void> {
    await this.cleanupExpiredAuditLogs();
    await this.cleanupExpiredSecurityEvents();
  }
}

export const auditService = new AuditService();
