/**
 * Custom Pattern Service
 * Handles saving, loading, and applying user-created shift patterns
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from '@/config/firestore.compat';
import { db } from '@/config/firebase.config';
import { CustomPattern, PatternCell, PatternPreview } from '@/types/customPattern';
import { ShiftType } from '@/types';

// Re-export for convenience
export type { PatternCell, CustomPattern, PatternPreview };
import { shiftService } from './shift.service';
import { addDays, addMonths, differenceInDays, startOfDay } from 'date-fns';

const COLLECTIONS = {
  CUSTOM_PATTERNS: 'customPatterns',
};

export class CustomPatternService {
  /**
   * Calculate the actual repeating cycle length of a pattern
   * E.g., if pattern is [work, work, off, off, off, off, off, work, work, off, off, off, off, off]
   * This would be a 7-day cycle, not 14
   * 
   * For an 8-day cycle like [work, work, work, work, off, off, off, off, work, work, work, work, off, off]
   * This function will correctly identify it as 8 days
   */
  calculateCycleLength(cells: PatternCell[]): number {
    // Try all possible cycle lengths from 1 to 14
    // Start with smallest to find the true repeating unit
  for (let cycleLength = 1; cycleLength <= 14; cycleLength++) {
      // For each potential cycle, check if entire 14-day pattern repeats correctly
      let repeats = true;

      // Additional guard: within the first cycle window, the same shiftType
      // should not have conflicting time windows. If times differ within the
      // first cycle for the same shiftType, this cycleLength is invalid.
      const timeSetByType: Record<string, Set<string>> = {};
      for (let j = 0; j < Math.min(cycleLength, cells.length); j++) {
        const c = cells[j];
        if (c.shiftType !== null) {
          const key = c.shiftType;
          const timeKey = `${c.startTime}-${c.endTime}`;
          timeSetByType[key] = timeSetByType[key] || new Set<string>();
          timeSetByType[key].add(timeKey);
        }
      }
      if (Object.values(timeSetByType).some(set => set.size > 1)) {
        repeats = false;
      }
      
      for (let i = 0; i < 14 && repeats; i++) {
        const currentCell = cells[i];
        const referenceCell = cells[i % cycleLength];
        
        // Check if shift type matches exactly (including null)
        if (currentCell.shiftType !== referenceCell.shiftType) {
          repeats = false;
          break;
        }
        
        // If both are work days, times must also match exactly for a repeat
        if (currentCell.shiftType !== null && referenceCell.shiftType !== null) {
          if (currentCell.startTime !== referenceCell.startTime ||
              currentCell.endTime !== referenceCell.endTime) {
            repeats = false;
            break;
          }
        }
      }
      
      if (repeats) {
        // If a 7-day repeat was detected but there is a difference between week 1 and week 2 times,
        // the above check already prevented it. So we can safely return.
        return cycleLength; // Found the smallest repeating cycle
      }
    }
    
  // No smaller repeating cycle found, default to full 14-day cycle
  return 14;
  }

  /**
   * Save a new custom pattern
   */
  async savePattern(
    userId: string,
    name: string,
    cells: PatternCell[],
    householdId?: string,
    description?: string,
    patternMode: 'weekly' | 'repetition' = 'repetition'
  ): Promise<string> {
    try {
      // Validate pattern has at least one working day
      const hasWorkingDay = cells.some(cell => cell.shiftType !== null);
      if (!hasWorkingDay) {
        throw new Error('Pattern must have at least one working day');
      }

      // Validate cells array is exactly 14 days
      if (cells.length !== 14) {
        throw new Error('Pattern must have exactly 14 days (2 weeks)');
      }
      const now = new Date();
      const patternData = {
        userId,
        householdId: householdId || null,
        name,
        description: description || '',
        cells,
        patternMode,
        createdAt: now,
        updatedAt: now,
        isShared: !!householdId,
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.CUSTOM_PATTERNS), patternData);
      
      return docRef.id;
    } catch (error) {
      console.error('Failed to save pattern:', error);
      throw error;
    }
  }

  /**
   * Get all patterns for a user
   */
  async getUserPatterns(userId: string): Promise<CustomPattern[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.CUSTOM_PATTERNS),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const patterns: CustomPattern[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Skip patterns with missing or invalid cells data
        if (!Array.isArray(data.cells) || data.cells.length === 0) {
          console.warn(`Skipping pattern ${doc.id}: missing or empty cells`);
          return;
        }
        patterns.push({
          id: doc.id,
          userId: data.userId,
          householdId: data.householdId,
          name: data.name,
          description: data.description,
          cells: data.cells,
          patternMode: data.patternMode || 'repetition', // Default to repetition for backward compatibility
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
          isShared: data.isShared || false,
        });
      });

      return patterns;
    } catch (error) {
      console.error('Failed to load patterns:', error);
      return [];
    }
  }

  /**
   * Get a specific pattern by ID
   */
  async getPattern(patternId: string): Promise<CustomPattern | null> {
    try {
      const docRef = doc(db, COLLECTIONS.CUSTOM_PATTERNS, patternId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        householdId: data.householdId,
        name: data.name,
        description: data.description,
        cells: data.cells,
        patternMode: data.patternMode || 'repetition', // Default to repetition for backward compatibility
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        isShared: data.isShared || false,
      };
    } catch (error) {
      console.error('Failed to load pattern:', error);
      return null;
    }
  }

  /**
   * Update an existing pattern
   */
  async updatePattern(
    patternId: string,
    updates: Partial<Pick<CustomPattern, 'name' | 'description' | 'cells' | 'isShared'>>
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CUSTOM_PATTERNS, patternId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to update pattern:', error);
      throw error;
    }
  }

  /**
   * Delete a pattern
   */
  async deletePattern(patternId: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.CUSTOM_PATTERNS, patternId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Failed to delete pattern:', error);
      throw error;
    }
  }

  /**
   * Preview pattern for next N days
   */
  previewPattern(
    pattern: CustomPattern,
    startDate: Date,
    previewDays: number = 28
  ): PatternPreview[] {
    const previews: PatternPreview[] = [];
    const startDay = startOfDay(startDate);

    for (let i = 0; i < previewDays; i++) {
      const currentDate = addDays(startDay, i);
      const cycleLength = this.calculateCycleLength(pattern.cells);
      const dayInPattern = i % cycleLength;
      const cell = pattern.cells[dayInPattern];

      if (cell.shiftType !== null) {
        previews.push({
          date: currentDate,
          shiftType: cell.shiftType,
          startTime: cell.startTime,
          endTime: cell.endTime,
        });
      }
    }

    return previews;
  }

  /**
   * Apply pattern to create shifts
   */
  async applyPattern(
    patternId: string,
    startDate: Date,
    durationMonths: number,
    userId: string,
    householdId?: string
  ): Promise<{ success: boolean; shiftsCreated: number; error?: string }> {
    try {
      // Load pattern
      const pattern = await this.getPattern(patternId);
      if (!pattern) {
        return { success: false, shiftsCreated: 0, error: 'Pattern not found' };
      }

      // Calculate end date
      const endDate = addMonths(startOfDay(startDate), durationMonths);

      // Determine cycle length based on pattern mode
      let cycleLength: number;
      if (pattern.patternMode === 'weekly') {
        // Weekly mode: Always use 7-day cycle (Mon-Sun repeat)
        cycleLength = 7;
      } else {
        // Repetition mode: Auto-detect the cycle length
        cycleLength = this.calculateCycleLength(pattern.cells);
      }

      // Generate shifts
      const shiftsToCreate: any[] = [];
      let currentDate = startOfDay(startDate);

      while (currentDate < endDate) {
        let dayInPattern: number;
        
        if (pattern.patternMode === 'weekly') {
          // WEEKLY MODE: Pattern cells are Monday-Sunday (0-6)
          // Map current date's day-of-week to pattern cell
          const currentDayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          // Convert Sunday=0 to pattern index 6, Monday=1 to index 0, etc.
          dayInPattern = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
        } else {
          // REPETITION MODE: Pattern starts from cell[0] on start date
          // and repeats the detected cycle
          const daysSinceStart = differenceInDays(currentDate, startDate);
          dayInPattern = daysSinceStart % cycleLength;
        }
        
        // Get cell for this day
        const cell = pattern.cells[dayInPattern];

        if (cell.shiftType !== null) {
          // Parse times
          const [startHour, startMinute] = cell.startTime.split(':').map(Number);
          const [endHour, endMinute] = cell.endTime.split(':').map(Number);

          const shiftStart = new Date(currentDate);
          shiftStart.setHours(startHour, startMinute, 0, 0);

          const shiftEnd = new Date(currentDate);
          shiftEnd.setHours(endHour, endMinute, 0, 0);

          // Handle overnight shifts
          if (shiftEnd < shiftStart) {
            shiftEnd.setDate(shiftEnd.getDate() + 1);
          }

          shiftsToCreate.push({
            ownerId: userId,
            householdId: householdId,
            shiftType: cell.shiftType,
            startTime: shiftStart,
            endTime: shiftEnd,
            title: cell.label || this.getShiftTypeLabel(cell.shiftType),
            notes: `From pattern: ${pattern.name}`,
          });
        }

        currentDate = addDays(currentDate, 1);
      }

      // Batch create shifts
      await shiftService.createBulkShifts(shiftsToCreate);

      return {
        success: true,
        shiftsCreated: shiftsToCreate.length,
      };
    } catch (error: any) {
      console.error('❌ [PATTERN] Failed to apply pattern:', error);
      return {
        success: false,
        shiftsCreated: 0,
        error: error.message || 'Failed to apply pattern',
      };
    }
  }

  /**
   * Get label for shift type
   */
  private getShiftTypeLabel(shiftType: ShiftType): string {
    const labels: Record<ShiftType, string> = {
      day: 'Day Shift',
      night: 'Night Shift',
      twilight: 'Twilight Shift',
      split: 'Split Shift',
      holiday: 'Holiday',
      off: 'Day Off',
      sick: 'Sick Leave',
      training: 'Training',
      custom: 'Custom Shift',
    };

    return labels[shiftType] || 'Shift';
  }

  /**
   * Validate pattern cells
   */
  validatePattern(cells: PatternCell[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (cells.length !== 14) {
      errors.push('Pattern must have exactly 14 days');
    }

    const hasWorkingDay = cells.some(cell => cell.shiftType !== null);
    if (!hasWorkingDay) {
      errors.push('Pattern must have at least one working day');
    }

    // Validate times
    cells.forEach((cell, index) => {
      if (cell.shiftType !== null) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(cell.startTime)) {
          errors.push(`Day ${index + 1}: Invalid start time format (use HH:mm)`);
        }
        if (!timeRegex.test(cell.endTime)) {
          errors.push(`Day ${index + 1}: Invalid end time format (use HH:mm)`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const customPatternService = new CustomPatternService();
