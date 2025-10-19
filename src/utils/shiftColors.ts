import {Shift, ShiftType} from '@/types';
import {isSameDay} from 'date-fns';

/**
 * Enhanced Shift Type Colors
 * Designed for accessibility (WCAG AA compliant) and visual clarity
 */

// Primary colors for shift types - User's own shifts
export const SHIFT_TYPE_COLORS: Record<ShiftType, string> = {
  day: '#4A90E2',        // Blue - Standard day shift
  night: '#4A4A4A',      // Dark Gray - Night shift
  twilight: '#9B59B6',   // Purple - Evening/twilight shift
  split: '#F39C12',      // Orange - Split shift
  holiday: '#FFD93D',    // Yellow - Holiday/annual leave ⭐ NEW
  off: '#F5F5F5',        // Light Gray - Scheduled day off ⭐ NEW
  sick: '#E74C3C',       // Red - Sick leave ⭐ NEW
  training: '#2ECC71',   // Green - Training day ⭐ NEW
  custom: '#95A5A6',     // Gray - Custom user-defined
};

// Display labels for each shift type (shown on calendar)
export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  day: 'D',
  night: 'N',
  twilight: 'T',
  split: 'S',
  holiday: 'HOL',        // ⭐ NEW
  off: 'OFF',            // ⭐ NEW
  sick: 'SICK',          // ⭐ NEW
  training: 'TRN',       // ⭐ NEW
  custom: 'C',
};

// Full names for shift types (used in UI)
export const SHIFT_TYPE_NAMES: Record<ShiftType, string> = {
  day: 'Day Shift',
  night: 'Night Shift',
  twilight: 'Twilight Shift',
  split: 'Split Shift',
  holiday: 'Holiday',
  off: 'Day Off',
  sick: 'Sick Leave',
  training: 'Training',
  custom: 'Custom',
};

// Emoji icons for shift types (optional, for enhanced UX)
export const SHIFT_TYPE_ICONS: Record<ShiftType, string> = {
  day: '☀️',
  night: '🌙',
  twilight: '🌆',
  split: '⏰',
  holiday: '🏖️',
  off: '🚫',
  sick: '🤒',
  training: '📚',
  custom: '⚙️',
};

// Colors for OTHER users (not the current user) - Lighter tints for differentiation
export const OTHER_USER_COLORS: Record<ShiftType, string> = {
  day: '#7EB3E0',        // Light blue
  night: '#6B6B6B',      // Medium gray
  twilight: '#BB8FCE',   // Light purple
  split: '#F8B739',      // Light orange
  holiday: '#FFE67D',    // Light yellow
  off: '#FAFAFA',        // Very light gray
  sick: '#F1948A',       // Light red
  training: '#76D7C4',   // Light green
  custom: '#B2BABB',     // Light gray
};

// Color for 3+ people working
export const MULTI_PERSON_COLOR = '#8B5CF6'; // Purple

// Pattern templates that users can easily select
export const SHIFT_PATTERNS = {
  '4on4off': {
    name: '4 Days On, 4 Days Off',
    workDays: 4,
    restDays: 4,
    description: 'Work 4 consecutive days, then 4 days off'
  },
  '2on3off': {
    name: '2 Days On, 3 Days Off', 
    workDays: 2,
    restDays: 3,
    description: 'Work 2 days, then 3 days off'
  },
  '5on2off': {
    name: '5 Days On, 2 Days Off',
    workDays: 5,
    restDays: 2,
    description: 'Traditional work week (Monday-Friday)'
  },
  '3on4off': {
    name: '3 Days On, 4 Days Off',
    workDays: 3,
    restDays: 4,
    description: 'Work 3 days, then 4 days off'
  },
  '7on7off': {
    name: '7 Days On, 7 Days Off',
    workDays: 7,
    restDays: 7,
    description: 'Work full week, then full week off'
  },
};

/**
 * Determines the appropriate color for a shift based on whether it's the current user or another user
 * @param shift - The shift to get color for
 * @param currentUserId - The ID of the current logged-in user
 * @param isCurrentUser - Whether this shift belongs to the current user
 */
export function getShiftColor(shift: Shift, currentUserId: string, isCurrentUser: boolean = false): string {
  // If no currentUserId provided, check if shift belongs to current user
  if (!isCurrentUser) {
    isCurrentUser = shift.ownerId === currentUserId;
  }
  
  // Use primary colors for current user, other colors for other users
  if (isCurrentUser) {
    return SHIFT_TYPE_COLORS[shift.shiftType];
  } else {
    return OTHER_USER_COLORS[shift.shiftType];
  }
}

/**
 * Analyzes shifts on a date to determine visualization strategy
 * Returns information about how many people and which colors to use
 */
export interface MultiPersonShiftInfo {
  userCount: number;
  colors: string[]; // Array of colors to display
  displayStrategy: 'single' | 'split' | 'multi';
  workingCount: number;
}

export function analyzeMultiPersonShifts(
  shiftsOnDate: Shift[], 
  currentUserId: string
): MultiPersonShiftInfo {
  // Group shifts by unique user (but keep ALL shifts, not just first)
  const userShiftMap = new Map<string, Shift[]>();
  
  shiftsOnDate.forEach(shift => {
    if (!userShiftMap.has(shift.ownerId)) {
      userShiftMap.set(shift.ownerId, []);
    }
    userShiftMap.get(shift.ownerId)!.push(shift);
  });
  
  const userCount = userShiftMap.size;
  const colors: string[] = [];
  
  // Determine colors based on number of people working
  if (userCount === 0) {
    // No one working
    return {
      userCount: 0,
      colors: [],
      displayStrategy: 'single',
      workingCount: 0,
    };
  } else if (userCount === 1) {
    // Single person - check if they have multiple shifts (e.g., split shift or day+night)
    const userShifts = Array.from(userShiftMap.values())[0];
    const isCurrentUser = userShifts[0].ownerId === currentUserId;
    
    if (userShifts.length > 1) {
      // Multiple shifts for same person - show colors side by side (prioritize latest shift)
      // Sort by start time and take last shift (most recent/relevant)
      const sortedShifts = userShifts.sort((a, b) => {
        const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
        const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
        return bTime - aTime;
      });
      const selectedShift = sortedShifts[0];
      colors.push(getShiftColor(selectedShift, currentUserId, isCurrentUser));
    } else {
      // Single shift
      colors.push(getShiftColor(userShifts[0], currentUserId, isCurrentUser));
    }
    
    return {
      userCount: 1,
      colors,
      displayStrategy: 'single',
      workingCount: 1,
    };
  } else if (userCount === 2) {
    // Two people - show both colors (current user first if present)
    const allUserShifts = Array.from(userShiftMap.values());
    const currentUserShifts = allUserShifts.find(shifts => shifts[0].ownerId === currentUserId);
    const otherUserShifts = allUserShifts.find(shifts => shifts[0].ownerId !== currentUserId);
    
    if (currentUserShifts) {
      // Take latest shift for current user
      const sortedShifts = currentUserShifts.sort((a, b) => {
        const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
        const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
        return bTime - aTime;
      });
      colors.push(getShiftColor(sortedShifts[0], currentUserId, true));
    }
    if (otherUserShifts) {
      // Take latest shift for other user
      const sortedShifts = otherUserShifts.sort((a, b) => {
        const aTime = a.startTime instanceof Date ? a.startTime.getTime() : new Date(a.startTime).getTime();
        const bTime = b.startTime instanceof Date ? b.startTime.getTime() : new Date(b.startTime).getTime();
        return bTime - aTime;
      });
      colors.push(getShiftColor(sortedShifts[0], currentUserId, false));
    }
    
    return {
      userCount: 2,
      colors,
      displayStrategy: 'split',
      workingCount: 2,
    };
  } else {
    // 3+ people - show multi-person indicator (purple)
    return {
      userCount,
      colors: [MULTI_PERSON_COLOR],
      displayStrategy: 'multi',
      workingCount: userCount,
    };
  }
}

/**
 * Determines shift type based on start time
 */
export function detectShiftType(startTime: Date, endTime: Date): ShiftType {
  const startHour = startTime.getHours();
  const endHour = endTime.getHours();
  
  // Night shift: starts after 20:00 or ends before 08:00
  if (startHour >= 20 || endHour <= 8 || (startHour < 8 && endHour < 16)) {
    return 'night';
  }
  
  // Twilight shift: starts after 14:00 and before 22:00
  if (startHour >= 14 && startHour < 22) {
    return 'twilight';
  }
  
  // Day shift: starts between 05:00 and 14:00
  if (startHour >= 5 && startHour < 14) {
    return 'day';
  }
  
  // Default to day for other times
  return 'day';
}

/**
 * Gets a user-friendly display name for shift type
 */
export function getShiftTypeDisplayName(shiftType: ShiftType): string {
  return SHIFT_TYPE_NAMES[shiftType] || 'Custom Shift';
}

/**
 * Gets shift type icon/emoji
 */
export function getShiftTypeIcon(shiftType: ShiftType): string {
  return SHIFT_TYPE_ICONS[shiftType] || '⭐';
}

/**
 * Validates if a pattern rule is valid
 */
export function validatePatternRule(workDays: number, restDays: number): boolean {
  return workDays > 0 && restDays >= 0 && (workDays + restDays) <= 14;
}

/**
 * Generates shift instances for a pattern over a date range
 */
export function generatePatternShifts(
  baseShift: Omit<Shift, 'id' | 'startTime' | 'endTime'>,
  startDate: Date,
  endDate: Date,
  shiftStartTime: { hour: number; minute: number },
  shiftEndTime: { hour: number; minute: number }
): Omit<Shift, 'id'>[] {
  const shifts: Omit<Shift, 'id'>[] = [];
  
  if (!baseShift.patternRule || baseShift.patternRule.type !== 'rotation') {
    return shifts;
  }
  
  const { workDays, restDays } = baseShift.patternRule;
  if (!workDays || restDays === undefined) return shifts;
  
  const cycleLength = workDays + restDays;
  const patternStart = baseShift.patternRule.startDate;
  
  // Calculate which day of the cycle we're starting from
  const daysSincePatternStart = Math.floor(
    (startDate.getTime() - patternStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayInCycle = (daysSincePatternStart + 
      Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) % cycleLength;
    
    // If this day is within the work period of the cycle
    if (dayInCycle < workDays) {
      const shiftStart = new Date(currentDate);
      shiftStart.setHours(shiftStartTime.hour, shiftStartTime.minute, 0, 0);
      
      const shiftEnd = new Date(currentDate);
      // Handle shifts that cross midnight
      if (shiftEndTime.hour < shiftStartTime.hour) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }
      shiftEnd.setHours(shiftEndTime.hour, shiftEndTime.minute, 0, 0);
      
      shifts.push({
        ...baseShift,
        startTime: shiftStart,
        endTime: shiftEnd,
      });
    }
    
    // Move to next day
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return shifts;
}