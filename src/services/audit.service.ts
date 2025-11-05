import { collection, addDoc, query, where, orderBy, getDocs } from '@/config/firestore.compat';
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
   * Get user's audit logs
   */
  async getUserAuditLogs(userId: string, limit: number = 50): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.slice(0, limit).map((docSnap: any) => ({
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
        orderBy('timestamp', 'desc')
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
   * Get all actions in a household (admin view)
   */
  async getHouseholdAuditLogs(householdId: string, limit: number = 100): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, this.collection),
        where('resourceId', '==', householdId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.slice(0, limit).map((docSnap: any) => ({
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
}

export const auditService = new AuditService();
