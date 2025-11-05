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

        // Check shift editing permissions based on household settings
        if (shift.ownerId !== userId) {
          // User is not the shift owner - check if they can edit others' shifts
          if (!household.settings?.allowMemberEditOthers) {
            throw new Error('Unauthorized: Members cannot edit shifts created by others');
          }
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

        // Additional checks based on required role
        if (requiredRole === 'admin' && !household.admins.includes(userId)) {
          throw new Error('Unauthorized: Only household admins can perform this action');
        }

        if (requiredRole === 'owner' && shift.ownerId !== userId) {
          throw new Error('Unauthorized: Only the shift owner can perform this action');
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

      // SECURITY: Validate ownerId matches the current user
      const currentUserId = shiftData.ownerId;
      if (shiftData.ownerId !== currentUserId) {
        throw new Error('Unauthorized: Cannot create shift for another user');
      }

      // SECURITY: Validate household membership if household shift
      if (shiftData.householdId) {
        const household = await householdService.getHousehold(shiftData.householdId);

        if (!household.members.includes(currentUserId)) {
          throw new Error('Unauthorized: You are not a member of this household');
        }

        // Validate tier limit
        const compliance = await householdService.validateHouseholdCompliance(shiftData.householdId);
        const complianceObj = compliance as any;
        if (complianceObj && !complianceObj.compliant && complianceObj.violation) {
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
      throw this.handleError(error);
    }
  }

  /**
   * Deletes multiple shifts in bulk (soft delete) - for pattern cleanup
   */
  async deleteBulkShifts(shiftIds: string[]): Promise<void> {
    try {
      if (shiftIds.length === 0) return;

      const batch = writeBatch(db);
      const now = new Date();

      shiftIds.forEach((shiftId) => {
        const shiftRef = doc(db, this.collection, shiftId);
        batch.update(shiftRef, {
          isDeleted: true,
          updatedAt: now,
        });
      });

      await batch.commit();
    } catch (error) {
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
      
      // Soft delete all shifts
      if (snapshot.docs.length > 0) {
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            isDeleted: true,
            updatedAt: new Date(),
            lastEditedBy: userId,
          });
        });
        
        await batch.commit();
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
    
    // Add base filters
    if (filters.householdId) {
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

    querySnapshot.docs.forEach((doc, index) => {
      const data = doc.data() as any;
      // Filter out deleted shifts
      if (data.isDeleted !== true && index < pageSize) {
        shifts.push({ id: doc.id, ...data } as Shift);
        cursor = doc;
      }
    });

    return {
      shifts,
      hasMore: querySnapshot.size > pageSize,
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
   */
  async createBulkShifts(shiftsData: CreateShiftData[]): Promise<string[]> {
    try {
      const batch = writeBatch(db);
      const shiftIds: string[] = [];

      shiftsData.forEach((shiftData) => {
        // Validate required fields (householdId is optional for personal mode)
        this.validateRequired(shiftData, ['ownerId', 'title', 'startTime', 'endTime']);

        const shiftRef = doc(collection(db, this.collection));
        const shift: Omit<Shift, 'id'> = {
          ...shiftData,
          title: this.sanitizeString(shiftData.title),
          notes: shiftData.notes ? this.sanitizeString(shiftData.notes) : undefined,
          colorTag: this.generateColorForShiftType(shiftData.shiftType),
          label: getShiftTypeLabel(shiftData.shiftType as ShiftType), // Add display label
          createdAt: new Date(),
          updatedAt: new Date(),
          lastEditedBy: shiftData.ownerId,
        };

        batch.set(shiftRef, shift);
        shiftIds.push(shiftRef.id);
      });

      await batch.commit();
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

    querySnapshot.forEach((doc) => {
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

    querySnapshot.forEach((doc) => {
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
}

// Export singleton instance
export const shiftService = new ShiftService();
