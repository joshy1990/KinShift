import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  arrayUnion, 
  arrayRemove, 
  writeBatch,
  DocumentSnapshot,
  QuerySnapshot 
} from '@/config/firestore.compat';
import {Household, HouseholdSettings, HouseholdMember} from '@/types';
import {COLLECTIONS, db, JOIN_CODE_EXPIRY_DAYS} from '@/config/firebase.config';
import {subscriptionService} from './subscription.service';
import { auditService } from './audit.service';
import { rbacService } from './rbac.service';

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

const JOIN_CODE_LENGTH = 6;

class HouseholdService {
  /**
   * Generate a random join code
   */
  private generateJoinCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Check if user is admin of household
   */
  async isHouseholdAdmin(householdId: string, userId: string): Promise<boolean> {
    try {
      const household = await this.getHousehold(householdId);
      return household.admins.includes(userId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if user can invite members to household
   */
  async canInviteMember(householdId: string, userId: string): Promise<PermissionCheckResult> {
    try {
      // Check if user is admin
      const isAdmin = await this.isHouseholdAdmin(householdId, userId);
      if (!isAdmin) {
        return {
          allowed: false,
          reason: 'Only admins can invite members',
        };
      }

      // Check subscription limits
      const household = await this.getHousehold(householdId);
      const currentMemberCount = household.members.length;
      
      // Get household creator's subscription to check limits
      const creatorId = household.creatorId || household.admins[0];
      const subscriptionCheck = await subscriptionService.canAddMember(creatorId, householdId);
      
      if (!subscriptionCheck.allowed) {
        return {
          allowed: false,
          reason: subscriptionCheck.reason,
        };
      }

      return {allowed: true};
    } catch (error: any) {
      return {
        allowed: false,
        reason: error.message || 'Failed to check permissions',
      };
    }
  }

  /**
   * Check if user can remove a member from household
   * Rules:
   * - Members can ALWAYS remove themselves (leave household)
   * - Admins can remove any member (except last admin can't remove themselves)
   * - Non-admins CANNOT remove other members
   */
  async canRemoveMember(
    householdId: string,
    userId: string,
    targetUserId: string,
  ): Promise<PermissionCheckResult> {
    try {
      const household = await this.getHousehold(householdId);

      // CASE 1: User is removing themselves (leaving household)
      if (userId === targetUserId) {
        // Check if they're the last admin
        if (
          household.admins.includes(targetUserId) &&
          household.admins.length === 1
        ) {
          return {
            allowed: false,
            reason: 'Cannot leave household as the last admin. Transfer ownership first or delete the household.',
          };
        }
        
        // Members can always remove themselves
        return {allowed: true};
      }

      // CASE 2: User is removing someone else
      // Only admins can remove other members
      if (!household.admins.includes(userId)) {
        return {
          allowed: false,
          reason: 'Only admins can remove other members from the household',
        };
      }

      // Admin is removing another member - allowed
      return {allowed: true};
    } catch (error: any) {
      return {
        allowed: false,
        reason: error.message || 'Failed to check permissions',
      };
    }
  }

  /**
   * Check if user can manage roles (promote/demote members)
   */
  async canManageRoles(householdId: string, userId: string): Promise<PermissionCheckResult> {
    try {
      const isAdmin = await this.isHouseholdAdmin(householdId, userId);
      
      if (!isAdmin) {
        return {
          allowed: false,
          reason: 'Only admins can manage roles',
        };
      }

      return {allowed: true};
    } catch (error: any) {
      return {
        allowed: false,
        reason: error.message || 'Failed to check permissions',
      };
    }
  }

  /**
   * Create a new household
   */
  async createHousehold(
    name: string,
    creatorId: string,
    settings?: Partial<HouseholdSettings>,
  ): Promise<Household> {
    try {
      const joinCode = this.generateJoinCode();
      const now = new Date();
      const householdData: Omit<Household, 'id'> = {
        name,
        joinCode,
        joinCodeCreatedAt: now,
        admins: [creatorId],
        members: [creatorId],
        creatorId,
        memberJoinDates: {
          [creatorId]: now,
        },
        createdAt: now,
        updatedAt: now,
        settings: {
          allowMemberEditOthers: false, // Deprecated: owner-only editing is enforced
          requireApprovalForShifts: settings?.requireApprovalForShifts ?? false,
          notifyOnConflicts: settings?.notifyOnConflicts ?? true,
        },
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.HOUSEHOLDS), householdData);

      return {
        ...householdData,
        id: docRef.id,
      };
    } catch (error) {
      throw new Error('Failed to create household');
    }
  }

  /**
   * Get household by ID
   */
  async getHousehold(householdId: string): Promise<Household> {
    try {
      const docSnap = await getDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId));

      if (!docSnap.exists()) {
        throw new Error('Household not found');
      }

      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as Household;
    } catch (error) {
      throw new Error('Failed to fetch household');
    }
  }

  /**
   * Get all households for a user
   */
  async getUserHouseholds(userId: string): Promise<Household[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.HOUSEHOLDS),
        where('members', 'array-contains', userId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as Household[];
    } catch (error) {
      throw new Error('Failed to fetch households');
    }
  }

  /**
   * Join household by join code
   */
  async joinHouseholdByCode(joinCode: string, userId: string): Promise<Household> {
    try {
      const q = query(
        collection(db, COLLECTIONS.HOUSEHOLDS),
        where('joinCode', '==', joinCode.toUpperCase())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error('Invalid join code');
      }

      const householdDoc = snapshot.docs[0];
      const household = householdDoc.data() as Household;
      const householdId = householdDoc.id;

      // Check if user is already a member
      if (household.members.includes(userId)) {
        throw new Error('You are already a member of this household');
      }

      // Check join code expiry
      if (JOIN_CODE_EXPIRY_DAYS > 0 && (household as any).joinCodeCreatedAt) {
        const codeCreated = (household as any).joinCodeCreatedAt?.toDate
          ? (household as any).joinCodeCreatedAt.toDate()
          : new Date((household as any).joinCodeCreatedAt);
        const expiryMs = JOIN_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - codeCreated.getTime() > expiryMs) {
          throw new Error('This join code has expired. Ask a household admin to regenerate it.');
        }
      }

      // Check subscription tier limits before adding member
      const creatorIdForTier = household.creatorId || household.admins[0];
      const tierCheck = await subscriptionService.canAddMember(creatorIdForTier, householdId);
      if (!tierCheck.allowed) {
        throw new Error(tierCheck.reason || 'Member limit reached for this household');
      }

      // Add user to members and track join date
      const now = new Date();
      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        members: arrayUnion(userId),
        [`memberJoinDates.${userId}`]: now,
        updatedAt: now,
      });

      // MIGRATION: Update user's personal shifts to household mode
      await this.migratePersonalShiftsToHousehold(userId, householdId);

      return {
        ...household,
        id: householdId,
        members: [...household.members, userId],
        memberJoinDates: {
          ...household.memberJoinDates,
          [userId]: now,
        },
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to join household');
    }
  }

  /**
   * Migrate user's personal shifts to household
   * Called when user joins a household
   */
  private async migratePersonalShiftsToHousehold(userId: string, householdId: string): Promise<void> {
    try {
      // Get all personal shifts (where householdId is undefined or empty)
      const shiftsQuery = query(
        collection(db, COLLECTIONS.SHIFTS),
        where('ownerId', '==', userId)
      );
      
      const shiftsSnapshot = await getDocs(shiftsQuery);
      
      if (shiftsSnapshot.empty) {
        return;
      }

      // Filter to shifts that need migration
      const docsToMigrate = shiftsSnapshot.docs.filter((shiftDoc) => {
        const shift = shiftDoc.data();
        return !shift.householdId;
      });

      if (docsToMigrate.length === 0) return;

      // Chunk into batches of 499 to stay under Firestore's 500-operation limit
      const BATCH_LIMIT = 499;
      for (let i = 0; i < docsToMigrate.length; i += BATCH_LIMIT) {
        const chunk = docsToMigrate.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((shiftDoc) => {
          batch.update(shiftDoc.ref, {
            householdId: householdId,
            updatedAt: new Date(),
          });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('❌ [MIGRATION ERROR] Failed to migrate personal shifts:', error);
      // Don't throw - household join should still succeed even if migration fails
    }
  }

  /**
   * Add member to household (used by invitation system)
   */
  async addMemberToHousehold(
    householdId: string, 
    userId: string, 
    role: 'member' | 'admin' = 'member'
  ): Promise<void> {
    try {
      const household = await this.getHousehold(householdId);
      
      if (!household) {
        throw new Error('Household not found');
      }

      // Check if user is already a member
      if (household.members.includes(userId)) {
        throw new Error('User is already a member of this household');
      }

      // Check subscription tier limits before adding member (use household creator's tier, not the joining user's)
      const creatorIdForTier = household.creatorId || household.admins[0];
      const tierCheck = await subscriptionService.canAddMember(creatorIdForTier, householdId);
      if (!tierCheck.allowed) {
        throw new Error(tierCheck.reason || 'Member limit reached for this household');
      }

      const updateData: any = {
        members: arrayUnion(userId),
        [`memberJoinDates.${userId}`]: new Date(),
      };

      if (role === 'admin') {
        updateData.admins = arrayUnion(userId);
      }

      updateData.updatedAt = new Date();

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), updateData);

      // MIGRATION: Update user's personal shifts to household mode
      await this.migratePersonalShiftsToHousehold(userId, householdId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to add member to household');
    }
  }

  /**
   * Remove member from household
   */
  async removeMember(householdId: string, userId: string, requestingUserId: string): Promise<void> {
    try {
      // Check permissions
      const canRemove = await this.canRemoveMember(householdId, requestingUserId, userId);
      if (!canRemove.allowed) {
        throw new Error(canRemove.reason || 'Cannot remove member');
      }

      const household = await this.getHousehold(householdId);

      // If removing the last admin, promote another member BEFORE removing
      if (household.admins.length === 1 && household.admins.includes(userId) && household.members.length > 1) {
        const secondMember = household.members.find(m => m !== userId);
        if (secondMember) {
          await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
            admins: arrayUnion(secondMember),
            updatedAt: new Date(),
          });
        }
      }

      // Now remove the member
      const updateData: any = {
        members: arrayRemove(userId),
        admins: arrayRemove(userId),
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), updateData);

      // Soft-delete the removed member's shifts in this household
      try {
        const { shiftService } = require('./shift.service');
        await shiftService.deleteUserShiftsInHousehold(householdId, userId);
      } catch (shiftError) {
        console.warn('[HouseholdService] Failed to clean up member shifts:', shiftError);
      }

      // Log audit trail
      await auditService.logHouseholdAction(householdId, requestingUserId, 'remove_member', {
        targetUserId: userId,
      });

      // Invalidate RBAC cache so permission changes take effect immediately
      rbacService.invalidateHousehold(householdId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to remove member');
    }
  }

  /**
   * Promote member to admin
   */
  async promoteMember(householdId: string, userId: string, requestingUserId: string): Promise<void> {
    try {
      const canManage = await this.canManageRoles(householdId, requestingUserId);
      if (!canManage.allowed) {
        throw new Error('Cannot manage roles in this household');
      }

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        admins: arrayUnion(userId),
        updatedAt: new Date(),
      });

      // Log audit trail
      await auditService.logHouseholdAction(householdId, requestingUserId, 'promote_member', {
        targetUserId: userId,
      });

      // Invalidate RBAC cache so permission changes take effect immediately
      rbacService.invalidateHousehold(householdId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to promote member');
    }
  }

  /**
   * Demote admin to member
   */
  async demoteMember(householdId: string, userId: string, requestingUserId: string): Promise<void> {
    try {
      const canManage = await this.canManageRoles(householdId, requestingUserId);
      if (!canManage.allowed) {
        throw new Error('Cannot manage roles in this household');
      }

      const household = await this.getHousehold(householdId);

      // Can't demote if it's the last admin
      if (household.admins.length === 1 && household.admins.includes(userId)) {
        throw new Error('Cannot demote the last admin');
      }

      const updateData: any = {
        admins: arrayRemove(userId),
      };

      // If this is the last admin and we have another member, promote them
      if (household.admins.length === 1 && household.admins.includes(userId) && household.members.length > 1) {
        const secondMember = household.members.find(m => m !== userId);
        if (secondMember) {
          updateData.admins = arrayUnion(secondMember);
        }
      }

      updateData.updatedAt = new Date();

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), updateData);

      // Log audit trail
      await auditService.logHouseholdAction(householdId, requestingUserId, 'demote_member', {
        targetUserId: userId,
      });

      // Invalidate RBAC cache so permission changes take effect immediately
      rbacService.invalidateHousehold(householdId);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to demote member');
    }
  }

  /**
   * Transfer household ownership
   */
  async transferOwnership(
    householdId: string,
    newOwnerId: string,
    currentOwnerId: string,
  ): Promise<void> {
    try {
      const household = await this.getHousehold(householdId);

      // Verify current owner is an admin
      if (!household.admins.includes(currentOwnerId)) {
        throw new Error('Only admins can transfer ownership');
      }

      // Verify new owner is a member
      if (!household.members.includes(newOwnerId)) {
        throw new Error('New owner must be a member of the household');
      }

      // Ensure new owner is admin
      const newAdmins = [newOwnerId, ...household.admins.filter((id: string) => id !== newOwnerId)];

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        admins: newAdmins,
        creatorId: newOwnerId,
        updatedAt: new Date(),
      });

      // Log audit trail
      await auditService.logHouseholdAction(householdId, currentOwnerId, 'transfer_ownership', {
        newOwnerId,
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to transfer ownership');
    }
  }

  /**
   * Listen to household updates
   */
  onHouseholdUpdates(householdId: string, callback: (household: Household | null) => void): () => void {
    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.HOUSEHOLDS, householdId),
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          callback({
            id: snapshot.id,
            ...snapshot.data(),
          } as Household);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to household:', error);
        callback(null);
      }
    );

    return unsubscribe;
  }

  /**
   * Listen to user's households
   */
  onUserHouseholdsUpdates(userId: string, callback: (households: Household[]) => void): () => void {
    const q = query(
      collection(db, COLLECTIONS.HOUSEHOLDS),
      where('members', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot) => {
        const households = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Household[];
        callback(households);
      },
      (error) => {
        console.error('Error listening to households:', error);
        callback([]);
      }
    );

    return unsubscribe;
  }

  /**
   * Get household members with their user data
   */
  async getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
    try {
      const household = await this.getHousehold(householdId);
      const memberPromises = household.members.map(async (userId: string) => {
        try {
          const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, userId));
          if (userDoc.exists()) {
            const userData = userDoc.data() || {};
            return {
              userId: userDoc.id,
              id: userDoc.id,
              name: userData.name || 'Unknown User',
              email: userData.email || '',
              role: household.admins.includes(userId) ? 'admin' : 'member',
              joinedAt: household.memberJoinDates?.[userId] || new Date(),
            } as HouseholdMember;
          }
        } catch (error) {
          console.warn(`Failed to fetch user ${userId}:`, error);
        }
        return null;
      });

      const members = await Promise.all(memberPromises);
      return members.filter((m): m is HouseholdMember => m !== null);
    } catch (error) {
      throw new Error('Failed to fetch household members');
    }
  }

  /**
   * Update household settings
   */
  async updateHouseholdSettings(
    householdId: string,
    settings: Partial<HouseholdSettings>,
  ): Promise<void> {
    try {
      // Use dot-notation to merge instead of overwriting the entire settings object
      const updateData: Record<string, any> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(settings)) {
        updateData[`settings.${key}`] = value;
      }
      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), updateData);
    } catch (error) {
      throw new Error('Failed to update household settings');
    }
  }

  /**
   * Regenerate join code
   */
  async regenerateJoinCode(householdId: string): Promise<string> {
    try {
      const newCode = this.generateJoinCode();
      const now = new Date();
      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        joinCode: newCode,
        joinCodeCreatedAt: now,
        updatedAt: now,
      });
      return newCode;
    } catch (error) {
      throw new Error('Failed to regenerate join code');
    }
  }

  /**
   * Delete household
   */
  async deleteHousehold(householdId: string, userId: string): Promise<void> {
    try {
      const household = await this.getHousehold(householdId);

      // Only admins can delete
      if (!household.admins.includes(userId)) {
        throw new Error('Only admins can delete household');
      }

      // Collect all document refs to delete: shifts, invitations, dayNotes, notifications, + household doc
      const collectRefs = async (collectionName: string, field: string = 'householdId') => {
        const q = query(collection(db, collectionName), where(field, '==', householdId));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.ref);
      };

      const [shiftRefs, invitationRefs, dayNoteRefs] = await Promise.all([
        collectRefs(COLLECTIONS.SHIFTS),
        collectRefs(COLLECTIONS.INVITATIONS),
        collectRefs(COLLECTIONS.DAY_NOTES),
      ]);

      const allRefs = [
        doc(db, COLLECTIONS.HOUSEHOLDS, householdId),
        ...shiftRefs,
        ...invitationRefs,
        ...dayNoteRefs,
      ];

      // Chunk deletes to respect 500-op batch limit
      const BATCH_LIMIT = 499;
      for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
        const chunk = allRefs.slice(i, i + BATCH_LIMIT);
        const batchOp = writeBatch(db);
        chunk.forEach(ref => batchOp.delete(ref));
        await batchOp.commit();
      }

      // Log audit trail
      await auditService.logHouseholdAction(householdId, userId, 'delete_household', {});
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete household');
    }
  }

  /**
   * Handle admin promotion and household downgrade when subscription changes
   */
  async handleAdminPromotionAndDowngrade(
    householdId: string,
    newAdminId: string,
    previousAdminId: string,
  ): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        admins: arrayUnion(newAdminId),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.warn('Failed to handle admin promotion:', error);
    }
  }

  /**
   * Leave household (remove self as member)
   */
  async leaveHousehold(householdId: string, userId: string): Promise<void> {
    try {
      const household = await this.getHousehold(householdId);

      // If you're the last admin and only member, delete the household
      if (household.admins.length === 1 && household.admins.includes(userId) && household.members.length === 1) {
        await this.deleteHousehold(householdId, userId);
      } else if (household.admins.includes(userId) && household.admins.length === 1) {
        // If you're the only admin but there are other members, promote the next member first
        const nextMember = household.members.find(m => m !== userId);
        if (nextMember) {
          // Promote next member to admin BEFORE removing self (otherwise canRemoveMember blocks)
          await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
            admins: arrayUnion(nextMember),
            updatedAt: new Date(),
          });
          // Now remove self (there are 2 admins, so canRemoveMember allows it)
          await this.removeMember(householdId, userId, userId);
        }
      } else {
        // Just remove yourself
        await this.removeMember(householdId, userId, userId);
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to leave household');
    }
  }

  /**
   * Validate household compliance with subscription
   */
  async validateHouseholdCompliance(householdId: string): Promise<boolean> {
    try {
      const household = await this.getHousehold(householdId);
      const admin = household.admins[0];
      const subscription = await subscriptionService.getUserSubscription(admin);
      
      if (!subscription) {
        return false;
      }

      // Use effective tier (accounts for cancellation/expiry)
      const limits = subscriptionService.getEffectiveTierLimits(subscription);
      
      // Check member limit
      if (household.members.length > limits.maxMembersPerHousehold) {
        console.warn(`Household exceeds member limit for ${subscription.tier} tier`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to validate household compliance:', error);
      return false;
    }
  }
}

// Add missing imports
import { onSnapshot } from '@/config/firestore.compat';

const { USERS } = COLLECTIONS;

export const householdService = new HouseholdService();
