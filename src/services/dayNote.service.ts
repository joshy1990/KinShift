import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  deleteDoc,
} from '@/config/firestore.compat';
import { db } from '@/config/firebase.config';
import { DayNote } from '@/types';
import { COLLECTIONS } from '@/config/firebase.config';
import { format, startOfDay, endOfDay } from 'date-fns';
import { shiftService } from './shift.service';
import { householdService } from './household.service';
import { rbacService, AuditAction } from './rbac.service';

/**
 * Service for managing day notes - household plans and events
 * E.g., "Swimming at 6pm", "Dentist appointment"
 */
class DayNoteService {
  /**
   * Create a new day note
   */
  async createNote(
    noteData: Omit<DayNote, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DayNote> {
    try {
      // Build note object, omitting householdId if undefined (personal note)
      const baseNote = {
        date: noteData.date,
        authorId: noteData.authorId,
        authorName: noteData.authorName,
        content: noteData.content,
        time: noteData.time,
        category: noteData.category,
        notifyWorkingMembers: noteData.notifyWorkingMembers,
        isDeleted: false, // CRITICAL: Must be set so queries with where('isDeleted', '!=', true) can find this note
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Only add householdId if it exists (personal notes won't have it)
      const note: any = noteData.householdId
        ? { ...baseNote, householdId: noteData.householdId }
        : baseNote;

      const docRef = await addDoc(collection(db, COLLECTIONS.DAY_NOTES), note);

      const createdNote: DayNote = {
        ...note,
        id: docRef.id,
      };

      // If notifyWorkingMembers is true AND in household mode, use smart category-based notification
      if (noteData.notifyWorkingMembers && noteData.householdId) {
        await this.notifyByCategory(createdNote);
      }

      return createdNote;
    } catch (error) {
      console.error('Failed to create day note:', error);
      throw new Error('Failed to create note');
    }
  }

  /**
   * Get all notes for a specific date
   * Works for both household mode (householdId) and personal mode (authorId)
   */
  async getNotesByDate(householdIdOrAuthorId: string, date: Date, isPersonalMode: boolean = false): Promise<DayNote[]> {
    try {
      const dateString = format(date, 'yyyy-MM-dd');

      const constraints: any[] = [
        where('date', '==', dateString),
        where('isDeleted', '!=', true),
      ];

      // In personal mode, query by authorId; in household mode, query by householdId
      if (isPersonalMode) {
        constraints.push(where('authorId', '==', householdIdOrAuthorId));
      } else {
        constraints.push(where('householdId', '==', householdIdOrAuthorId));
      }

      constraints.push(orderBy('createdAt', 'asc'));

      const q = query(collection(db, COLLECTIONS.DAY_NOTES), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as DayNote[];
    } catch (error) {
      console.error('Failed to fetch notes by date:', error);
      throw new Error('Failed to fetch notes');
    }
  }

  /**
   * Get all notes for a date range (for calendar view)
   */
  async getNotesInRange(
    householdId: string,
    startDate: Date,
    endDate: Date
  ): Promise<DayNote[]> {
    try {
      const startDateString = format(startDate, 'yyyy-MM-dd');
      const endDateString = format(endDate, 'yyyy-MM-dd');

      const q = query(
        collection(db, COLLECTIONS.DAY_NOTES),
        where('householdId', '==', householdId),
        where('date', '>=', startDateString),
        where('date', '<=', endDateString),
        where('isDeleted', '!=', true),
        orderBy('date', 'asc'),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as DayNote[];
    } catch (error) {
      console.error('Failed to fetch notes in range:', error);
      throw new Error('Failed to fetch notes');
    }
  }

  /**
   * Update an existing note
   * RBAC: Only author or household admin can update
   */
  async updateNote(
    noteId: string,
    userId: string,
    householdId: string | undefined,
    updates: Partial<Omit<DayNote, 'id' | 'createdAt' | 'householdId' | 'authorId'>>
  ): Promise<void> {
    try {
      // Get the existing note to check permissions
      const noteRef = doc(db, COLLECTIONS.DAY_NOTES, noteId);
      const noteDoc = await getDoc(noteRef);

      if (!noteDoc.exists()) {
        throw new Error('Note not found');
      }

      const note = noteDoc.data() as DayNote;

      // RBAC: Check authorization
      if (householdId) {
        // Household note: author or admin can update
        const permissionResult = await rbacService.enforceAdminOrOwner(
          householdId,
          userId,
          note.authorId,
          AuditAction.DAYNOTE_UPDATE
        );

        if (!permissionResult.allowed) {
          throw new Error(permissionResult.reason || 'Unauthorized');
        }
      } else {
        // Personal note: only author can update
        if (userId !== note.authorId) {
          throw new Error('Unauthorized: Only the note author can update personal notes');
        }
      }

      // Update the note
      await updateDoc(noteRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to update note:', error);
      throw error instanceof Error ? error : new Error('Failed to update note');
    }
  }

  /**
   * Delete a note (soft delete)
   * RBAC: Only author or household admin can delete
   */
  async deleteNote(
    noteId: string,
    userId: string,
    householdId: string | undefined
  ): Promise<void> {
    try {
      // Get the existing note to check permissions
      const noteRef = doc(db, COLLECTIONS.DAY_NOTES, noteId);
      const noteDoc = await getDoc(noteRef);

      if (!noteDoc.exists()) {
        throw new Error('Note not found');
      }

      const note = noteDoc.data() as DayNote;

      // RBAC: Check authorization
      if (householdId) {
        // Household note: author or admin can delete
        const permissionResult = await rbacService.enforceAdminOrOwner(
          householdId,
          userId,
          note.authorId,
          AuditAction.DAYNOTE_DELETE
        );

        if (!permissionResult.allowed) {
          throw new Error(permissionResult.reason || 'Unauthorized');
        }
      } else {
        // Personal note: only author can delete
        if (userId !== note.authorId) {
          throw new Error('Unauthorized: Only the note author can delete personal notes');
        }
      }

      // Perform soft delete
      await updateDoc(noteRef, {
        isDeleted: true,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error instanceof Error ? error : new Error('Failed to delete note');
    }
  }

  /**
   * Subscribe to notes for a specific date (real-time)
   */
  subscribeToDateNotes(
    householdId: string,
    date: Date,
    callback: (notes: DayNote[]) => void
  ): () => void {
    const dateString = format(date, 'yyyy-MM-dd');

    const q = query(
      collection(db, COLLECTIONS.DAY_NOTES),
      where('householdId', '==', householdId),
      where('date', '==', dateString),
      where('isDeleted', '!=', true),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot: any) => {
        const notes = snapshot.docs.map((docSnap: any) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as DayNote[];
        callback(notes);
      },
      (error: any) => {
        console.error('Error subscribing to notes:', error);
      }
    );

    return unsubscribe;
  }

  /**
   * Smart notification system based on note category
   * - Event category: Notify ALL household members
   * - Other categories: Notify creator only (or specified recipients)
   */
  private async notifyByCategory(note: DayNote): Promise<void> {
    try {
      // Only works in household mode
      if (!note.householdId) {
        return;
      }

      const noteDate = new Date(note.date);
      let recipientUserIds = new Set<string>();

      // Route notification based on category
      if (note.category === 'event') {
        // Event category: Notify ALL household members
        try {
          const householdMembers = await householdService.getHouseholdMembers(note.householdId);
          
          if (householdMembers && householdMembers.length > 0) {
            // Use HouseholdMember objects from service
            const allMemberIds = householdMembers.map((m: any) => m.userId);
            recipientUserIds = new Set(allMemberIds);
            // Don't notify the author
            recipientUserIds.delete(note.authorId);
          }
        } catch (error) {
          console.error('Error getting household members for event notification:', error);
          // Fallback: Try direct Firestore query
          const householdDoc = await getDoc(doc(db, COLLECTIONS.HOUSEHOLDS, note.householdId));

          if (householdDoc.exists()) {
            const data = householdDoc.data() as any;
            const allMembers = [...(data.admins || []), ...(data.members || [])];
            recipientUserIds = new Set(allMembers);
            recipientUserIds.delete(note.authorId);
          }
        }
      } else {
        // Other categories (appointment, reminder, childcare, other): 
        // Get only members working on this day
        const dayStart = startOfDay(noteDate);
        const dayEnd = endOfDay(noteDate);

        const shifts = await shiftService.getHouseholdShifts(
          note.householdId,
          dayStart,
          dayEnd
        );

        // Get unique user IDs who are working (excluding the note author)
        shifts.forEach((shift) => {
          if (shift.ownerId !== note.authorId) {
            recipientUserIds.add(shift.ownerId);
          }
        });
      }

      // Create notifications for each recipient
      if (recipientUserIds.size > 0) {
        const batch = writeBatch(db);
        const formattedDate = format(noteDate, 'MMMM d');
        const recipientList = Array.from(recipientUserIds);

        recipientList.forEach((userId) => {
          const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS).doc();
          const notification = {
            id: notificationRef.id,
            userId,
            householdId: note.householdId,
            type: 'day_note_added',
            title: 'New Day Note',
            body: `${note.authorName} has left a note on ${formattedDate}`,
            data: {
              type: 'day_note_added',
              noteId: note.id,
              date: note.date,
              authorId: note.authorId,
              authorName: note.authorName,
              category: note.category,
              time: note.time,
              content: note.content,
              householdId: note.householdId,
            },
            read: false,
            createdAt: new Date(),
          };

          batch.set(notificationRef, notification);
        });

        await batch.commit();
      }
    } catch (error) {
      console.error('Failed to send smart notifications:', error);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Notify household members who are working on the date of the note
   * @deprecated Use notifyByCategory instead for smarter routing
   */
  private async notifyWorkingMembers(note: DayNote): Promise<void> {
    try {
      // Only works in household mode
      if (!note.householdId) {
        return;
      }

      // Parse the date string to Date object
      const noteDate = new Date(note.date);
      const dayStart = startOfDay(noteDate);
      const dayEnd = endOfDay(noteDate);

      // Get all shifts for this household on this date
      const shifts = await shiftService.getHouseholdShifts(
        note.householdId,
        dayStart,
        dayEnd
      );

      // Get unique user IDs who are working (excluding the note author)
      const workingUserIds = new Set<string>();
      shifts.forEach((shift) => {
        if (shift.ownerId !== note.authorId) {
          workingUserIds.add(shift.ownerId);
        }
      });

      // Create notifications for each working member
      const batch = writeBatch(db);
      
      Array.from(workingUserIds).forEach((userId) => {
        const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS).doc();
        const notification = {
          id: notificationRef.id,
          userId,
          householdId: note.householdId,
          type: 'day_note_added',
          title: 'Day Plan Added',
          body: `${note.authorName} added a plan for ${format(noteDate, 'MMMM d')}: ${note.content}`,
          data: {
            noteId: note.id,
            date: note.date,
            authorId: note.authorId,
          },
          read: false,
          createdAt: new Date(),
        };
        
        batch.set(notificationRef, notification);
      });

      if (workingUserIds.size > 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Failed to notify working members:', error);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Get notes grouped by date (for calendar view)
   */
  async getNotesGroupedByDate(
    householdId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, DayNote[]>> {
    try {
      const notes = await this.getNotesInRange(householdId, startDate, endDate);
      
      const grouped: Record<string, DayNote[]> = {};
      notes.forEach((note) => {
        if (!grouped[note.date]) {
          grouped[note.date] = [];
        }
        grouped[note.date].push(note);
      });

      return grouped;
    } catch (error) {
      console.error('Failed to get grouped notes:', error);
      throw new Error('Failed to get grouped notes');
    }
  }

  /**
   * Check if a specific date has notes
   */
  async hasNotes(householdId: string, date: Date): Promise<boolean> {
    try {
      const dateString = format(date, 'yyyy-MM-dd');

      const q = query(
        collection(db, COLLECTIONS.DAY_NOTES),
        where('householdId', '==', householdId),
        where('date', '==', dateString),
        where('isDeleted', '!=', true),
        limit(1)
      );

      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Failed to check for notes:', error);
      return false;
    }
  }

  /**
   * Get note count for multiple dates (for calendar indicators)
   */
  async getNoteCounts(
    householdId: string,
    dates: Date[]
  ): Promise<Record<string, number>> {
    try {
      if (dates.length === 0) return {};

      const dateStrings = dates.map((date) => format(date, 'yyyy-MM-dd'));
      const startDateString = dateStrings[0];
      const endDateString = dateStrings[dateStrings.length - 1];

      const q = query(
        collection(db, COLLECTIONS.DAY_NOTES),
        where('householdId', '==', householdId),
        where('date', '>=', startDateString),
        where('date', '<=', endDateString),
        where('isDeleted', '!=', true)
      );

      const snapshot = await getDocs(q);

      const counts: Record<string, number> = {};
      snapshot.docs.forEach((docSnap: any) => {
        const note = docSnap.data() as DayNote;
        counts[note.date] = (counts[note.date] || 0) + 1;
      });

      return counts;
    } catch (error) {
      console.error('Failed to get note counts:', error);
      return {};
    }
  }
}

export const dayNoteService = new DayNoteService();
