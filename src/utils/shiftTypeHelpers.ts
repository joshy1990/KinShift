/**
 * Shift Type Helpers
 * Utilities for working with the enhanced shift type system
 */

import { ShiftType } from '@/types';
import { 
  SHIFT_TYPE_COLORS, 
  SHIFT_TYPE_LABELS, 
  SHIFT_TYPE_NAMES, 
  SHIFT_TYPE_ICONS 
} from './shiftColors';

/**
 * Get the color for a shift type
 */
export function getShiftTypeColor(shiftType: ShiftType): string {
  return SHIFT_TYPE_COLORS[shiftType] || SHIFT_TYPE_COLORS.custom;
}

/**
 * Get the display label for a shift type (e.g., "D", "HOL", "OFF")
 */
export function getShiftTypeLabel(shiftType: ShiftType): string {
  return SHIFT_TYPE_LABELS[shiftType] || 'C';
}

/**
 * Get the full name for a shift type
 */
export function getShiftTypeName(shiftType: ShiftType): string {
  return SHIFT_TYPE_NAMES[shiftType] || 'Custom';
}

/**
 * Get the icon/emoji for a shift type
 */
export function getShiftTypeEmoji(shiftType: ShiftType): string {
  return SHIFT_TYPE_ICONS[shiftType] || '⚙️';
}

/**
 * Check if a shift type is a working shift (not holiday, off, or sick)
 */
export function isWorkingShift(shiftType: ShiftType): boolean {
  return !['holiday', 'off', 'sick'].includes(shiftType);
}

/**
 * Check if a shift type requires start/end times
 * Holiday and OFF days are all-day events and don't need specific times
 */
export function requiresStartEndTime(shiftType: ShiftType): boolean {
  return !['holiday', 'off', 'custom'].includes(shiftType);
}

/**
 * Get all available shift types
 */
export function getAllShiftTypes(): ShiftType[] {
  return [
    'day',
    'night',
    'twilight',
    'split',
    'holiday',
    'off',
    'sick',
    'training',
    'custom',
  ];
}

/**
 * Get common/quick-access shift types (for quick add menu)
 * Only shows the top 3 most common types - users click "More" for full list
 */
export function getQuickShiftTypes(): ShiftType[] {
  const types: ShiftType[] = ['day', 'night', 'twilight'];
  return types;
}

/**
 * Get text color based on background color (for accessibility)
 * Returns 'dark' for light backgrounds, 'light' for dark backgrounds
 */
export function getTextColorForBackground(backgroundColor: string): 'light' | 'dark' {
  // Convert hex to RGB
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return dark text for light backgrounds, light text for dark backgrounds
  return luminance > 0.5 ? 'dark' : 'light';
}

/**
 * Get shift type description (for tooltips/help)
 */
export function getShiftTypeDescription(shiftType: ShiftType): string {
  const descriptions: Record<ShiftType, string> = {
    day: 'Standard day shift (typically 8:00-16:00)',
    night: 'Night shift (typically 20:00-08:00)',
    twilight: 'Evening/twilight shift (typically 14:00-22:00)',
    split: 'Multiple shifts in one day with breaks',
    holiday: 'Annual leave or holiday',
    off: 'Scheduled day off from work',
    sick: 'Sick leave or medical absence',
    training: 'Training day or professional development',
    custom: 'Custom user-defined shift type',
  };
  
  return descriptions[shiftType] || 'Custom shift';
}

/**
 * Validate if two shifts on the same day can coexist
 * Returns true if they can coexist, false if there's a conflict
 */
export function canShiftsCoexist(shift1Type: ShiftType, shift2Type: ShiftType): boolean {
  // Holiday, OFF, and Sick cannot coexist with working shifts
  const allDayTypes: ShiftType[] = ['holiday', 'off', 'sick'];
  
  if (allDayTypes.includes(shift1Type) || allDayTypes.includes(shift2Type)) {
    // If either is an all-day type, they can't coexist unless both are split shifts
    return shift1Type === 'split' || shift2Type === 'split';
  }
  
  // Split shifts can coexist with anything (that's their purpose)
  if (shift1Type === 'split' || shift2Type === 'split') {
    return true;
  }
  
  // Regular working shifts generally conflict (same person can't work two shifts)
  // unless explicitly marked as split
  return false;
}

/**
 * Sort shift types for display (working shifts first, then special types)
 */
export function sortShiftTypes(types: ShiftType[]): ShiftType[] {
  const order: Record<ShiftType, number> = {
    day: 1,
    night: 2,
    twilight: 3,
    split: 4,
    holiday: 5,
    off: 6,
    sick: 7,
    training: 8,
    custom: 9,
  };
  
  return types.sort((a, b) => order[a] - order[b]);
}
