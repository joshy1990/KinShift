import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  arrayUnion, 
  arrayRemove, 
  writeBatch,
  Timestamp,
  DocumentSnapshot,
  QuerySnapshot 
} from 'firebase/firestore';
import {Household, HouseholdSettings, HouseholdMember} from '@/types';
import {COLLECTIONS, JOIN_CODE_LENGTH, JOIN_CODE_EXPIRY_DAYS, db} from '@/config/firebase.config';
import {subscriptionService} from './subscription.service';
import {shiftService} from './shift.service';
import { auditService } from './audit.service';
import { notificationService } from './notification.service';

interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

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
      const creatorId = household.admins[0]; // First admin is creator
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
        admins: [creatorId],
        members: [creatorId],
        memberJoinDates: {
          [creatorId]: now,
        },
        createdAt: now,
        updatedAt: now,
        settings: {
          allowMemberEditOthers: settings?.allowMemberEditOthers ?? false,
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

      // Check subscription tier limits before adding member
      const tierCheck = await subscriptionService.canAddMember(userId, householdId);
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

      // Use batch to update all shifts
      const batch = writeBatch(db);
      let migratedCount = 0;

      shiftsSnapshot.docs.forEach((shiftDoc) => {
        const shift = shiftDoc.data();
        
        // Only migrate if shift doesn't already have a householdId
        if (!shift.householdId) {
          batch.update(shiftDoc.ref, {
            householdId: householdId,
            updatedAt: new Date(),
          });
          migratedCount++;
        }
      });

      if (migratedCount > 0) {
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

      // Check subscription tier limits before adding member
      const tierCheck = await subscriptionService.canAddMember(userId, householdId);
      if (!tierCheck.allowed) {
        throw new Error(tierCheck.reason || 'Member limit reached for this household');
      }

      const updateData: any = {
        members: arrayUnion(userId),
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

      // If removing an admin, we need to reassign household to another member if this is the last admin
      const updateData: any = {
        members: arrayRemove(userId),
        admins: arrayRemove(userId),
      };

      // If no admins remain, promote another member
      if (household.admins.length === 1 && household.admins.includes(userId) && household.members.length > 1) {
        const secondMember = household.members.find(m => m !== userId);
        if (secondMember) {
          // Set this member as the new admin
            updateData.admins = arrayUnion(secondMember);
        }
      }

      updateData.updatedAt = new Date();

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), updateData);

      // Log audit trail
      await auditService.logHouseholdAction(householdId, requestingUserId, 'remove_member', {
        targetUserId: userId,
      });
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
      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        settings,
        updatedAt: new Date(),
      });
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
      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdId), {
        joinCode: newCode,
        updatedAt: new Date(),
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

      const batch = writeBatch(db);

      // Delete household
      batch.delete(doc(db, COLLECTIONS.HOUSEHOLDS, householdId));

      // Delete all shifts for this household
      const shiftsQuery = query(
        collection(db, COLLECTIONS.SHIFTS),
        where('householdId', '==', householdId)
      );
      const shiftsSnapshot = await getDocs(shiftsQuery);
      shiftsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

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
        // If you're the only admin but there are other members, promote the next member
        const nextMember = household.members.find(m => m !== userId);
        if (nextMember) {
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

      const limits = subscriptionService.getTierLimits(subscription.tier);
      
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
import { onSnapshot } from 'firebase/firestore';

const { USERS } = COLLECTIONS;

export const householdService = new HouseholdService();
