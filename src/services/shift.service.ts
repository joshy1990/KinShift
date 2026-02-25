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
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  QueryConstraint
} from '@/config/firestore.compat';
import { db } from '@/config/firebase.config';
import { Shift, ShiftMessage, DayMessage, User, ShiftType } from '@/types';
import { BaseService, ServiceError } from './base.service';
import { householdService } from './household.service';
import { notificationService } from './notification.service';
import { authService } from './auth.service';
import { getShiftTypeColor, getShiftTypeLabel } from '@/utils/shiftTypeHelpers';

export interface CreateShiftData {
  householdId?: string; // Optional - for personal mode (individual users)
  ownerId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  shiftType: ShiftType;
  notes?: string;
  recurringRule?: any;
  patternRule?: any;
  splitTimes?: Array<{ startTime: Date; endTime: Date }>; // For split shifts
}

export interface UpdateShiftData {
  title?: string;
  startTime?: Date;
  endTime?: Date;
  shiftType?: ShiftType;
  notes?: string;
}

export interface ShiftFilters {
  householdId?: string; // Optional - for personal mode
  startDate?: Date;
  endDate?: Date;
  ownerId?: string;
  shiftType?: string;
}

export interface PaginationOptions {
  pageSize?: number;
  cursor?: DocumentSnapshot;
}

export class ShiftService extends BaseService {
  private readonly collection = 'shifts';
  private readonly messagesCollection = 'shiftMessages';
  private readonly dayMessagesCollection = 'dayMessages';

  /**
   * SECURITY & ENFORCEMENT: Validate shift permissions with household settings
   */
  private async validateShiftPermissionWithSettings(
    shiftId: string,
    userId: string,
    requiredRole: 'owner' | 'admin' | 'member' = 'member',
  ): Promise<void> {
    try {
      const shiftRef = doc(db, this.collection, shiftId);
      const shiftDoc = await getDoc(shiftRef);

      if (!shiftDoc.exists()) {
        throw new Error('Shift not found');
      }

      const shift = shiftDoc.data() as Shift;

      // Validate household membership if household shift
      if (shift.householdId) {
        const household = await householdService.getHousehold(shift.householdId);

        // User must be a member
        if (!household.members.includes(userId)) {
          throw new Error('Unauthorized: You are not a member of this household');
        }

        // OWNER-ONLY: Only the shift owner can edit their own shifts
        if (shift.ownerId !== userId) {
          throw new Error('Unauthorized: You can only edit your own shifts');
        }

        // Additional checks based on required role
        if (requiredRole === 'admin' && !household.admins.includes(userId)) {
          throw new Error('Unauthorized: Only household admins can perform this action');
        }
      } else {
        // Personal shift - only owner can modify
        if (shift.ownerId !== userId) {
          throw new Error('Unauthorized: Only the shift owner can modify personal shifts');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * SECURITY: Validate shift permissions before modification
   */
  private async validateShiftPermission(
    shiftId: string,
    userId: string,
    requiredRole: 'owner' | 'admin' | 'member' = 'member',
  ): Promise<void> {
    try {
      const shiftRef = doc(db, this.collection, shiftId);
      const shiftDoc = await getDoc(shiftRef);

      if (!shiftDoc.exists()) {
        throw new Error('Shift not found');
      }

      const shift = shiftDoc.data() as Shift;

      // Validate household membership if household shift
      if (shift.householdId) {
        const household = await householdService.getHousehold(shift.householdId);

        // User must be a member
        if (!household.members.includes(userId)) {
          throw new Error('Unauthorized: You are not a member of this household');
        }

        // OWNER-ONLY: Only the shift owner can modify their own shifts
        if (shift.ownerId !== userId) {
          throw new Error('Unauthorized: You can only modify your own shifts');
        }

        // Additional checks based on required role
        if (requiredRole === 'admin' && !household.admins.includes(userId)) {
          throw new Error('Unauthorized: Only household admins can perform this action');
        }
      } else {
        // Personal shift - only owner can modify
        if (shift.ownerId !== userId) {
          throw new Error('Unauthorized: Only the shift owner can modify personal shifts');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Creates a new shift
   */
  async createShift(shiftData: CreateShiftData): Promise<Shift> {
    try {
      this.validateRequired(shiftData, ['ownerId', 'title', 'startTime', 'endTime']);

      // SECURITY: Validate ownerId matches the current authenticated user
      const currentUser = await authService.getCurrentUser();
      if (!currentUser || shiftData.ownerId !== currentUser.id) {
        throw new Error('Unauthorized: Cannot create shift for another user');
      }
      const currentUserId = currentUser.id;

      // SECURITY: Validate household membership if household shift
      if (shiftData.householdId) {
        const household = await householdService.getHousehold(shiftData.householdId);

        if (!household.members.includes(currentUserId)) {
          throw new Error('Unauthorized: You are not a member of this household');
        }

        // Validate tier limit
        const isCompliant = await householdService.validateHouseholdCompliance(shiftData.householdId);
        if (!isCompliant) {
          throw new Error('Household has exceeded member limit for subscription tier');
        }
      }

      // SECURITY: Validate shift dates
      if (shiftData.endTime <= shiftData.startTime) {
        throw new Error('Shift end time must be after start time');
      }

      // SECURITY: Validate title
      if (!shiftData.title || shiftData.title.trim().length === 0) {
        throw new Error('Shift title cannot be empty');
      }

      if (shiftData.title.length > 100) {
        throw new Error('Shift title must be less than 100 characters');
      }

      // Build shift object, omitting undefined fields (Firebase doesn't allow undefined)
      const baseShift: any = {
        ownerId: shiftData.ownerId,
        title: this.sanitizeString(shiftData.title),
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        shiftType: shiftData.shiftType,
        colorTag: this.generateColorForShiftType(shiftData.shiftType),
        label: getShiftTypeLabel(shiftData.shiftType as ShiftType), // Add display label
        createdAt: new Date(),
        updatedAt: new Date(),
        lastEditedBy: shiftData.ownerId,
      };

      // Only add optional fields if they have values
      if (shiftData.householdId) {
        baseShift.householdId = shiftData.householdId;
        
        // ENFORCEMENT: Check if household requires approval for new shifts
        const household = await householdService.getHousehold(shiftData.householdId);
        if (household.settings?.requireApprovalForShifts) {
          // Set shift as pending approval
          baseShift.isApproved = false;
          baseShift.approvalStatus = 'pending';
          baseShift.approvedBy = null;
          baseShift.approvalRejectionReason = null;
        } else {
          // Shift is automatically approved
          baseShift.isApproved = true;
          baseShift.approvalStatus = 'approved';
          baseShift.approvedBy = shiftData.ownerId;
        }
      } else {
        // Personal shifts are always approved
        baseShift.isApproved = true;
        baseShift.approvalStatus = 'approved';
        baseShift.approvedBy = shiftData.ownerId;
      }
      
      if (shiftData.notes) {
        baseShift.notes = this.sanitizeString(shiftData.notes);
      }
      if (shiftData.recurringRule) {
        baseShift.recurringRule = shiftData.recurringRule;
      }
      if (shiftData.patternRule) {
        baseShift.patternRule = shiftData.patternRule;
      }
      if (shiftData.splitTimes && Array.isArray(shiftData.splitTimes)) {
        baseShift.splitTimes = shiftData.splitTimes;
      }

      const docRef = await addDoc(collection(db, this.collection), baseShift);

      const createdShift = {
        id: docRef.id,
        ...baseShift,
      };

      // Send notifications to household members if this is a household shift
      if (shiftData.householdId) {
        try {
          const household = await householdService.getHousehold(shiftData.householdId);
          const createdUser = await authService.getUserData(shiftData.ownerId);
          
          await notificationService.notifyShiftCreated(
            createdShift,
            household,
            createdUser?.name || 'Team Member'
          );
        } catch (notificationError) {
          // Don't fail the shift creation if notification fails
          console.warn('[ShiftService] Notification failed but shift created successfully:', notificationError);
        }
      }

      return createdShift;
    } catch (error) {
      console.error('[ShiftService] Failed to create shift:', error);
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing shift
   */
  async updateShift(shiftId: string, updates: UpdateShiftData, userId: string): Promise<void> {
    try {
      if (!shiftId || Object.keys(updates).length === 0) {
        throw new Error('Invalid shift ID or no updates provided');
      }

      // ENFORCEMENT: Use settings-aware validation to check household permissions
      await this.validateShiftPermissionWithSettings(shiftId, userId, 'owner');

      // SECURITY: Cannot change ownerId
      if ('ownerId' in updates) {
        throw new Error('Unauthorized: Cannot change shift owner');
      }

      // SECURITY: Validate updated fields
      if (updates.endTime && updates.startTime) {
        if (updates.endTime <= updates.startTime) {
          throw new Error('Shift end time must be after start time');
        }
      }

      if (updates.title && updates.title.length > 100) {
        throw new Error('Shift title must be less than 100 characters');
      }

      const sanitizedUpdates = {
        ...updates,
        title: updates.title ? this.sanitizeString(updates.title) : undefined,
        notes: updates.notes ? this.sanitizeString(updates.notes) : undefined,
        updatedAt: new Date(),
        lastEditedBy: userId,
      };

      // Remove undefined values
      const cleanUpdates: any = {};
      for (const [key, value] of Object.entries(sanitizedUpdates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }

      const shiftRef = doc(db, this.collection, shiftId);
      await updateDoc(shiftRef, cleanUpdates);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a shift (soft delete)
   */
  async deleteShift(shiftId: string, userId: string): Promise<void> {
    try {
      // SECURITY: Validate permission before allowing delete
      await this.validateShiftPermission(shiftId, userId, 'owner');

      const shiftRef = doc(db, this.collection, shiftId);
      await updateDoc(shiftRef, {
        isDeleted: true,
        updatedAt: new Date(),
        lastEditedBy: userId,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Deletes multiple shifts in bulk (soft delete) - for pattern cleanup
   * Properly chunked to respect Firestore's 500-operation batch limit.
   */
  async deleteBulkShifts(shiftIds: string[], userId: string): Promise<void> {
    try {
      if (shiftIds.length === 0) return;
      if (!userId) throw new Error('Unauthorized: userId is required for bulk delete');

      // SECURITY: Verify ownership of every shift before deleting
      const allShiftDocs = await Promise.all(
        shiftIds.map(id => getDoc(doc(db, this.collection, id)))
      );
      for (const shiftDoc of allShiftDocs) {
        if (!shiftDoc.exists()) continue; // skip already-deleted
        const data = shiftDoc.data() as Shift;
        if (data.ownerId !== userId) {
          throw new Error(`Unauthorized: You can only delete your own shifts (shift ${shiftDoc.id} belongs to another user)`);
        }
      }

      const BATCH_LIMIT = 499;
      const now = new Date();

      for (let i = 0; i < shiftIds.length; i += BATCH_LIMIT) {
        const chunk = shiftIds.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);

        chunk.forEach((shiftId) => {
          const shiftRef = doc(db, this.collection, shiftId);
          batch.update(shiftRef, {
            isDeleted: true,
            updatedAt: now,
            lastEditedBy: userId,
          });
        });

        await batch.commit();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      throw this.handleError(error);
    }
  }

  /**
   * Deletes all shifts for a user in a specific household
   * Called when a user leaves a household to remove their shifts from that household
   */
  async deleteUserShiftsInHousehold(householdId: string, userId: string): Promise<void> {
    try {
      // Find all shifts for this user in this household
      const q = query(
        collection(db, this.collection),
        where('householdId', '==', householdId),
        where('ownerId', '==', userId),
        where('isDeleted', '!=', true)
      );
      
      const snapshot = await getDocs(q);
      
      // Soft delete all shifts, chunked to respect 500-op batch limit
      if (snapshot.docs.length > 0) {
        const BATCH_LIMIT = 499;
        for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
          const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);

          chunk.forEach((d) => {
            batch.update(d.ref, {
              isDeleted: true,
              updatedAt: new Date(),
              lastEditedBy: userId,
            });
          });

          await batch.commit();
        }
      }
    } catch (error) {
      console.error(`Error deleting user shifts in household:`, error);
      throw this.handleError(error);
    }
  }

/**
 * Deletes a shift document from Firestore by its ID.
 * @param shiftId The Firestore document ID of the shift to delete.
 * @returns Promise<void>
 */
// Removed invalid export async function declaration from inside the class.

  /**
   * Gets shifts for a household with filtering and pagination
   */
  async getShifts(
  filters: ShiftFilters,
  pagination ?: PaginationOptions
): Promise < { shifts: Shift[]; hasMore: boolean; cursor?: DocumentSnapshot } > {
  try {
    // Build query constraints array
    const constraints: any[] = [];
    
    // Add base filters — allow combining householdId + ownerId for scoped queries
    if (filters.householdId && filters.ownerId) {
      // Both specified: scope to this user's shifts within this household
      constraints.push(where('householdId', '==', filters.householdId));
      constraints.push(where('ownerId', '==', filters.ownerId));
    } else if (filters.householdId) {
      constraints.push(where('householdId', '==', filters.householdId));
    } else if (filters.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    } else {
      throw new Error('Either householdId or ownerId must be provided');
    }

    // Add date range filters if provided
    if (filters.startDate && filters.endDate) {
      constraints.push(where('startTime', '>=', filters.startDate));
      constraints.push(where('startTime', '<=', filters.endDate));
    }

    // Add ordering
    constraints.push(orderBy('startTime', 'desc'));

    // Add pagination
    const pageSize = pagination?.pageSize || 50;
    constraints.push(limit(pageSize + 1)); // Get one extra to check if there are more

    if (pagination?.cursor) {
      constraints.push(startAfter(pagination.cursor));
    }

    // Build and execute query
    const q = query(collection(db, this.collection), ...constraints);
    const querySnapshot = await getDocs(q);
    const shifts: Shift[] = [];
    let cursor: DocumentSnapshot | undefined;
    let hasMore = false;

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as any;
      // Filter out soft-deleted shifts client-side
      if (data.isDeleted === true) continue;

      if (shifts.length < pageSize) {
        shifts.push({ id: docSnap.id, ...data } as Shift);
        cursor = docSnap;
      } else {
        // We found one more non-deleted shift beyond pageSize — there are more pages
        hasMore = true;
        break;
      }
    }

    return {
      shifts,
      hasMore,
      cursor,
};
    } catch (error) {
  throw this.handleError(error);
}
  }

  /**
   * Gets a single shift by ID
   */
  async getShiftById(shiftId: string): Promise < Shift | null > {
  try {
    const shiftRef = doc(db, this.collection, shiftId);
    const shiftDoc = await getDoc(shiftRef);

    if(!shiftDoc.exists()) {
  return null;
}

return { id: shiftDoc.id, ...shiftDoc.data() } as Shift;
    } catch (error) {
  throw this.handleError(error);
}
  }

/**
 * Real-time subscription to shifts
 */
  subscribeToShifts(
  filters: ShiftFilters,
  callback: (shifts: Shift[]) => void,
  onError ?: (error: ServiceError) => void
  ): Unsubscribe {
  try {
    // Build query - either by household or by owner (personal mode)
    const constraints: any[] = [];
    
    if (filters.householdId) {
      // Household mode - query by householdId only
      constraints.push(where('householdId', '==', filters.householdId));
    } else if (filters.ownerId) {
      // Personal mode - query by ownerId only
      constraints.push(where('ownerId', '==', filters.ownerId));
    } else {
      throw new Error('Either householdId or ownerId must be provided');
    }

    // SCALABILITY: Add date range filter to prevent unbounded reads.
    // Default to a 6-month rolling window so the listener doesn't grow
    // linearly with the user's history.
    if (filters.startDate) {
      constraints.push(where('startTime', '>=', filters.startDate));
    } else {
      // Fallback: only load shifts from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      constraints.push(where('startTime', '>=', sixMonthsAgo));
    }
    if (filters.endDate) {
      constraints.push(where('startTime', '<=', filters.endDate));
    }
    
    // Add ordering
    constraints.push(orderBy('startTime', 'asc'));
    
    const q = query(collection(db, this.collection), ...constraints);

    return onSnapshot(
      q,
      (querySnapshot) => {
        const shifts: Shift[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Only filter out deleted shifts - let UI handle date filtering
          if (data.isDeleted !== true) {
            shifts.push({ id: doc.id, ...data } as Shift);
          }
        });
        
        callback(shifts);
      },
      (error) => {
        console.error('Shift subscription error:', error);
        onError?.(this.handleError(error));
      }
    );
  } catch (error) {
    throw this.handleError(error);
  }
}

  /**
   * Creates bulk shifts (for patterns)
   * Includes auth validation, household membership checks, approval flow, and batch chunking
   */
  async createBulkShifts(shiftsData: CreateShiftData[]): Promise<string[]> {
    try {
      if (shiftsData.length === 0) return [];

      // SECURITY: Validate authenticated user
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Unauthorized: Must be logged in to create shifts');
      }

      // SECURITY: Validate all shifts belong to current user
      const invalidOwner = shiftsData.find(s => s.ownerId !== currentUser.id);
      if (invalidOwner) {
        throw new Error('Unauthorized: Cannot create shifts for another user');
      }

      // SECURITY: Validate household membership if household shifts
      const householdId = shiftsData[0]?.householdId;
      let requiresApproval = false;
      if (householdId) {
        const household = await householdService.getHousehold(householdId);
        if (!household.members.includes(currentUser.id)) {
          throw new Error('Unauthorized: You are not a member of this household');
        }
        // Check tier compliance
        const isCompliant = await householdService.validateHouseholdCompliance(householdId);
        if (!isCompliant) {
          throw new Error('Household has exceeded member limit for subscription tier');
        }
        requiresApproval = !!household.settings?.requireApprovalForShifts;
      }

      const shiftIds: string[] = [];
      const BATCH_LIMIT = 499; // Firestore batch limit is 500

      // Process in chunks to avoid exceeding Firestore batch limit
      for (let i = 0; i < shiftsData.length; i += BATCH_LIMIT) {
        const chunk = shiftsData.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);

        chunk.forEach((shiftData) => {
          this.validateRequired(shiftData, ['ownerId', 'title', 'startTime', 'endTime']);

          const shiftRef = collection(db, this.collection).doc();

          // Build shift with approval flow matching createShift logic
          const shift: any = {
            ...shiftData,
            title: this.sanitizeString(shiftData.title),
            notes: shiftData.notes ? this.sanitizeString(shiftData.notes) : undefined,
            colorTag: this.generateColorForShiftType(shiftData.shiftType),
            label: getShiftTypeLabel(shiftData.shiftType as ShiftType),
            createdAt: new Date(),
            updatedAt: new Date(),
            lastEditedBy: shiftData.ownerId,
          };

          // Apply approval flow
          if (shiftData.householdId && requiresApproval) {
            shift.isApproved = false;
            shift.approvalStatus = 'pending';
            shift.approvedBy = null;
          } else {
            shift.isApproved = true;
            shift.approvalStatus = 'approved';
            shift.approvedBy = shiftData.ownerId;
          }

          // Remove undefined values (Firestore rejects them)
          Object.keys(shift).forEach(key => {
            if (shift[key] === undefined) delete shift[key];
          });

          batch.set(shiftRef, shift);
          shiftIds.push(shiftRef.id);
        });

        await batch.commit();
      }

      return shiftIds;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Adds a message to a shift
   */
  async addShiftMessage(
  shiftId: string,
  message: string,
  authorId: string,
  authorName: string,
  isPrivate: boolean = false
): Promise < ShiftMessage > {
  try {
    this.validateRequired({ shiftId, message, authorId, authorName },
      ['shiftId', 'message', 'authorId', 'authorName']);

    // Get shift to validate it exists and get householdId
    const shift = await this.getShiftById(shiftId);
    if(!shift) {
      throw new Error('Shift not found');
    }

      const messageData: Omit<ShiftMessage, 'id'> = {
  shiftId,
    householdId: shift.householdId || '', // Use empty string if no household (personal mode)
      authorId,
      authorName,
      message: this.sanitizeString(message),
        isPrivate,
        createdAt: new Date(),
      };

const docRef = await addDoc(collection(db, this.messagesCollection), messageData);

return {
  id: docRef.id,
  ...messageData,
};
    } catch (error) {
  throw this.handleError(error);
}
  }

  /**
   * Gets messages for a shift
   */
  async getShiftMessages(shiftId: string): Promise < ShiftMessage[] > {
  try {
    const q = query(
      collection(db, this.messagesCollection),
      where('shiftId', '==', shiftId),
      orderBy('createdAt', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const messages: ShiftMessage[] = [];

    querySnapshot.docs.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as ShiftMessage);
    });

    return messages;
  } catch(error) {
    throw this.handleError(error);
  }
}

  /**
   * Adds a message for a specific day
   */
  async addDayMessage(
  householdId: string,
  date: string,
  message: string,
  authorId: string,
  authorName: string,
  priority: 'low' | 'medium' | 'high' = 'medium',
  recipientId: string = '',
  recipientName: string = ''
): Promise < DayMessage > {
  try {
    this.validateRequired({ householdId, date, message, authorId, authorName },
      ['householdId', 'date', 'message', 'authorId', 'authorName']);

    const messageData: Omit<DayMessage, 'id'> = {
  householdId,
    date,
    authorId,
    authorName,
    recipientId,
    recipientName,
    message: this.sanitizeString(message),
      priority,
      isRead: false,
        createdAt: new Date(),
          updatedAt: new Date(),
      };

const docRef = await addDoc(collection(db, this.dayMessagesCollection), messageData);

return {
  id: docRef.id,
  ...messageData,
};
    } catch (error) {
  throw this.handleError(error);
}
  }

  /**
   * Gets day messages for a household
   */
  async getDayMessages(householdId: string, startDate: string, endDate: string): Promise < DayMessage[] > {
  try {
    const q = query(
      collection(db, this.dayMessagesCollection),
      where('householdId', '==', householdId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc'),
      orderBy('createdAt', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const messages: DayMessage[] = [];

    querySnapshot.docs.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as DayMessage);
    });

    return messages;
  } catch(error) {
    throw this.handleError(error);
  }
}

  /**
   * Generates color based on shift type (using new system)
   */
  private generateColorForShiftType(shiftType: string): string {
    return getShiftTypeColor(shiftType as ShiftType);
  }

  // ============================================
  // BACKWARDS COMPATIBILITY ALIASES
  // ============================================

  /**
   * Alias for getShiftById
   */
  async getShift(shiftId: string): Promise < Shift | null > {
  return this.getShiftById(shiftId);
}

  /**
   * Gets shifts for household in date range (backwards compatibility)
   */
  async getHouseholdShifts(householdId: string, startDate: Date, endDate: Date): Promise < Shift[] > {
  const result = await this.getShifts({
    householdId,
    startDate,
    endDate,
  });
  return result.shifts;
}

/**
 * Real-time listener for household shifts (backwards compatibility)
 */
listenToHouseholdShifts(
  householdId: string,
  startDate: Date,
  endDate: Date,
  callback: (shifts: Shift[]) => void,
  onError ?: (error: ServiceError) => void
  ): Unsubscribe {
  return this.subscribeToShifts(
    { householdId, startDate, endDate },
    callback,
    onError
  );
}

  /**
   * Alias for getShifts
   */
  async getShiftsForDateRange(
  householdId: string,
  startDate: Date,
  endDate: Date
): Promise < Shift[] > {
  const result = await this.getShifts({
    householdId,
    startDate,
    endDate,
  });
  return result.shifts;
}

  /**
   * Alias for getShifts
   */
  async getShiftsForHousehold(householdId: string): Promise < Shift[] > {
  const result = await this.getShifts({ householdId });
  return result.shifts;
}

  // ============================================
  // DATA RETENTION / PURGE
  // ============================================

  /**
   * Hard-delete shifts that were soft-deleted more than `retentionDays` ago.
   * Should be called periodically (e.g. on app startup) to reclaim storage.
   */
  async purgeSoftDeletedShifts(retentionDays: number = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    // SECURITY: Only purge the current user's soft-deleted shifts
    const currentUser = await authService.getCurrentUser();
    if (!currentUser) return 0;

    const q = query(
      collection(db, 'shifts'),
      where('isDeleted', '==', true),
      where('ownerId', '==', currentUser.id),
      where('updatedAt', '<=', cutoff),
      limit(500)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;

    let deleted = 0;
    const refs = snapshot.docs.map((d) => d.ref);

    for (let i = 0; i < refs.length; i += 499) {
      const chunk = refs.slice(i, i + 499);
      const batch = writeBatch(db);
      chunk.forEach((ref) => batch.delete(ref));
      await batch.commit();
      deleted += chunk.length;
    }

    console.log(`[ShiftService] Purged ${deleted} soft-deleted shifts older than ${retentionDays}d`);
    return deleted;
  }
}

// Export singleton instance
export const shiftService = new ShiftService();
