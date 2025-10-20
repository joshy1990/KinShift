/**
 * RBAC Service (Role-Based Access Control)
 * Centralized authorization enforcement for all operations
 * Provides consistent permission checks and security enforcement
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase.config';
import { Household, User } from '@/types';
import { auditService } from './audit.service';

/**
 * Permission check result with detailed feedback
 */
export interface RBACResult {
  allowed: boolean;
  reason?: string;
  code?: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_STATE';
}

/**
 * Action types for audit logging
 */
export enum AuditAction {
  SHIFT_CREATE = 'shift:create',
  SHIFT_UPDATE = 'shift:update',
  SHIFT_DELETE = 'shift:delete',
  MEMBER_INVITE = 'member:invite',
  MEMBER_REMOVE = 'member:remove',
  MEMBER_PROMOTE = 'member:promote',
  MEMBER_DEMOTE = 'member:demote',
  SETTINGS_UPDATE = 'settings:update',
  DAYNOTE_CREATE = 'daynote:create',
  DAYNOTE_UPDATE = 'daynote:update',
  DAYNOTE_DELETE = 'daynote:delete',
  SUBSCRIPTION_CANCEL = 'subscription:cancel',
  SUBSCRIPTION_UPGRADE = 'subscription:upgrade',
  HOUSEHOLD_DELETE = 'household:delete',
  HOUSEHOLD_TRANSFER = 'household:transfer',
}

class RBACService {
  /**
   * Check if user is a household admin
   */
  async isHouseholdAdmin(householdId: string, userId: string): Promise<boolean> {
    try {
      const householdRef = doc(db, 'households', householdId);
      const householdDoc = await getDoc(householdRef);
      
      if (!householdDoc.exists()) {
        return false;
      }

      const household = householdDoc.data() as Household;
      return Array.isArray(household.admins) && household.admins.includes(userId);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if user is a household member (admin or regular member)
   */
  async isHouseholdMember(householdId: string, userId: string): Promise<boolean> {
    try {
      const householdRef = doc(db, 'households', householdId);
      const householdDoc = await getDoc(householdRef);
      
      if (!householdDoc.exists()) {
        return false;
      }

      const household = householdDoc.data() as Household;
      return (
        (Array.isArray(household.members) && household.members.includes(userId)) ||
        (Array.isArray(household.admins) && household.admins.includes(userId))
      );
    } catch (error) {
      console.error('Error checking member status:', error);
      return false;
    }
  }

  /**
   * Enforce: User must be admin to perform action
   * Returns structured error if not authorized
   */
  async enforceAdminOnly(
    householdId: string,
    userId: string,
    action: AuditAction
  ): Promise<RBACResult> {
    try {
      // Check if user is admin
      const isAdmin = await this.isHouseholdAdmin(householdId, userId);

      if (!isAdmin) {
        // Log unauthorized attempt
        await auditService.log({
          userId,
          householdId,
          action,
          resourceType: 'household',
          resourceId: householdId,
          success: false,
          details: {
            reason: 'Admin permission required',
            attemptedAction: action,
          },
        }).catch(err => console.error('Audit log error:', err));

        return {
          allowed: false,
          reason: 'Admin permission required for this action',
          code: 'FORBIDDEN',
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('RBAC enforcement error:', error);
      return {
        allowed: false,
        reason: error.message || 'Authorization check failed',
        code: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Enforce: User must be member to perform action
   * Returns structured error if not authorized
   */
  async enforceMemberOnly(
    householdId: string,
    userId: string,
    action: AuditAction
  ): Promise<RBACResult> {
    try {
      // Check if user is member
      const isMember = await this.isHouseholdMember(householdId, userId);

      if (!isMember) {
        // Log unauthorized attempt
        await auditService.log({
          userId,
          householdId,
          action,
          resourceType: 'household',
          resourceId: householdId,
          success: false,
          details: {
            reason: 'Must be household member',
            attemptedAction: action,
          },
        }).catch(err => console.error('Audit log error:', err));

        return {
          allowed: false,
          reason: 'Must be a household member to perform this action',
          code: 'FORBIDDEN',
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('RBAC enforcement error:', error);
      return {
        allowed: false,
        reason: error.message || 'Authorization check failed',
        code: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Enforce: User must be admin OR the resource owner
   * Used for operations like "edit my day note"
   */
  async enforceAdminOrOwner(
    householdId: string,
    userId: string,
    resourceOwnerId: string,
    action: AuditAction
  ): Promise<RBACResult> {
    try {
      const isAdmin = await this.isHouseholdAdmin(householdId, userId);
      const isOwner = userId === resourceOwnerId;

      if (!isAdmin && !isOwner) {
        // Log unauthorized attempt
        await auditService.log({
          userId,
          householdId,
          action,
          resourceType: 'resource',
          resourceId: resourceOwnerId,
          success: false,
          details: {
            reason: 'Must be admin or resource owner',
            attemptedAction: action,
            ownerId: resourceOwnerId,
          },
        }).catch(err => console.error('Audit log error:', err));

        return {
          allowed: false,
          reason: 'You do not have permission to modify this resource',
          code: 'FORBIDDEN',
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('RBAC enforcement error:', error);
      return {
        allowed: false,
        reason: error.message || 'Authorization check failed',
        code: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Enforce: Last admin protection
   * Cannot remove or demote the last admin
   */
  async enforceNotLastAdmin(
    householdId: string,
    targetUserId: string,
    action: AuditAction,
    operatorUserId: string
  ): Promise<RBACResult> {
    try {
      const householdRef = doc(db, 'households', householdId);
      const householdDoc = await getDoc(householdRef);

      if (!householdDoc.exists()) {
        return {
          allowed: false,
          reason: 'Household not found',
          code: 'NOT_FOUND',
        };
      }

      const household = householdDoc.data() as Household;
      const adminCount = household.admins?.length || 0;
      const isTargetAdmin = household.admins?.includes(targetUserId);

      // If target is admin and it's the last admin, prevent action
      if (isTargetAdmin && adminCount === 1) {
        await auditService.log({
          userId: operatorUserId,
          householdId,
          action,
          resourceType: 'household',
          resourceId: householdId,
          success: false,
          details: {
            reason: 'Cannot remove last admin',
            targetUserId,
          },
        }).catch(err => console.error('Audit log error:', err));

        return {
          allowed: false,
          reason: 'Cannot remove or demote the last admin. Transfer ownership first.',
          code: 'INVALID_STATE',
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('RBAC enforcement error:', error);
      return {
        allowed: false,
        reason: error.message || 'Authorization check failed',
        code: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Enforce: Prevent self-operations that don't make sense
   * Cannot invite yourself, cannot change your own role without admin agreement, etc.
   */
  async enforceSelfOperation(
    userId: string,
    targetUserId: string,
    action: AuditAction,
    allowSelf: boolean = false
  ): Promise<RBACResult> {
    if (userId === targetUserId && !allowSelf) {
      return {
        allowed: false,
        reason: 'Cannot perform this operation on yourself',
        code: 'INVALID_STATE',
      };
    }

    return { allowed: true };
  }

  /**
   * Check household member count against subscription limit
   */
  async checkMemberLimit(
    householdId: string,
    creatorId: string
  ): Promise<RBACResult> {
    try {
      const householdRef = doc(db, 'households', householdId);
      const householdDoc = await getDoc(householdRef);

      if (!householdDoc.exists()) {
        return {
          allowed: false,
          reason: 'Household not found',
          code: 'NOT_FOUND',
        };
      }

      const household = householdDoc.data() as Household;
      const memberCount = (household.members?.length || 0) + (household.admins?.length || 0);

      // Get subscription service dynamically to avoid circular dependency
      try {
        const subscriptionService = (await import('./subscription.service')).subscriptionService;
        const limit = await subscriptionService.getHouseholdMemberLimit(creatorId, householdId);

        if (memberCount >= limit) {
          return {
            allowed: false,
            reason: `Member limit (${limit}) reached for your subscription tier. Upgrade to add more members.`,
            code: 'INVALID_STATE',
          };
        }
      } catch (error) {
        console.warn('Could not check subscription limits:', error);
        // Don't block if we can't verify limits - fail open
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('Member limit check error:', error);
      return {
        allowed: false,
        reason: error.message || 'Could not verify member limits',
        code: 'UNAUTHORIZED',
      };
    }
  }

  /**
   * Convert RBAC error to HTTP status code
   */
  getHTTPStatus(rbacResult: RBACResult): number {
    switch (rbacResult.code) {
      case 'FORBIDDEN':
        return 403;
      case 'UNAUTHORIZED':
        return 401;
      case 'NOT_FOUND':
        return 404;
      case 'INVALID_STATE':
        return 400;
      default:
        return 403;
    }
  }

  /**
   * Create standardized error message
   */
  createErrorMessage(rbacResult: RBACResult): string {
    if (!rbacResult.allowed) {
      return rbacResult.reason || 'Permission denied';
    }
    return '';
  }
}

export const rbacService = new RBACService();
