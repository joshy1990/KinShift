// Custom Pattern Builder Types
import { ShiftType } from './index';

export interface PatternCell {
  day: number; // 1-14 (day of 2-week cycle)
  shiftType: ShiftType | null; // null = day off
  startTime: string; // "06:00" format
  endTime: string; // "18:00" format
  label?: string; // Optional custom label
}

export interface CustomPattern {
  id: string;
  userId: string; // Pattern owner
  householdId?: string; // Optional: shared with household
  name: string; // "My 2 Days 2 Nights"
  description?: string; // Optional description
  cells: PatternCell[]; // 14 cells (2 weeks)
  patternMode: 'weekly' | 'repetition'; // How to interpret the pattern
  createdAt: Date;
  updatedAt: Date;
  isShared?: boolean; // Can other household members use it?
}

export interface PatternApplication {
  patternId: string;
  startDate: Date;
  endDate: Date;
  durationMonths: number;
}

export interface PatternPreview {
  date: Date;
  shiftType: ShiftType | null;
  startTime: string;
  endTime: string;
}
