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
 * Audit Service - Logs all sensitive operations for security and compliance.
 * 
 * SECURITY: All reads/deletes are scoped to the authenticated user's own
 * documents via Firestore rules (resource.data.userId == request.auth.uid).
 * Cross-user TTL cleanup is handled by the scheduled Cloud Function
 * (functions/src/scheduledCleanup.ts), NOT by client-side code.
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
   * Get user's own audit logs (scoped to userId by Firestore rules)
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
   * Get resource's audit logs filtered by the current user.
   * Only returns logs the user authored (Firestore rules enforce userId scope).
   */
  async getResourceAuditLogs(userId: string, resourceType: string, resourceId: string): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
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
   * Get household audit logs authored by the current user.
   * Full cross-member household audit view requires Cloud Function endpoint.
   */
  async getHouseholdAuditLogs(userId: string, householdId: string, maxResults: number = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
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

      console.warn(`SECURITY EVENT: ${eventType} by ${userId}`);
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  // =========================================================================
  // DATA RETENTION / TTL CLEANUP (scoped to own userId)
  // Cross-user cleanup is handled by the Cloud Function scheduledCleanup.
  // =========================================================================

  /**
   * Purge the current user's audit logs older than AUDIT_LOG_TTL_DAYS (90 days).
   * Scoped to userId — Firestore rules enforce read/delete only on own docs.
   */
  async cleanupExpiredAuditLogs(userId: string): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - AUDIT_LOG_TTL_DAYS);

      const expiredQuery = query(
        collection(db, this.collection),
        where('userId', '==', userId),
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
        console.log(`Purged ${deletedCount} expired audit logs (>${AUDIT_LOG_TTL_DAYS}d) for user ${userId}`);
      }
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired audit logs:', error);
      return 0;
    }
  }

  /**
   * Purge the current user's security events older than SECURITY_EVENT_TTL_DAYS (365 days).
   * Scoped to userId — Firestore rules enforce read/delete only on own docs.
   */
  async cleanupExpiredSecurityEvents(userId: string): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - SECURITY_EVENT_TTL_DAYS);

      const expiredQuery = query(
        collection(db, 'securityEvents'),
        where('userId', '==', userId),
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
        console.log(`Purged ${deletedCount} expired security events (>${SECURITY_EVENT_TTL_DAYS}d) for user ${userId}`);
      }
      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup expired security events:', error);
      return 0;
    }
  }

  /**
   * Run all TTL cleanup jobs for the given user. Call on app start.
   * Cross-user global cleanup is handled by the scheduledCleanup Cloud Function.
   */
  async runRetentionCleanup(userId: string): Promise<void> {
    await this.cleanupExpiredAuditLogs(userId);
    await this.cleanupExpiredSecurityEvents(userId);
  }
}

export const auditService = new AuditService();
