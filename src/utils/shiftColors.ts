import {Shift, ShiftType} from '@/types';
import {isSameDay} from 'date-fns';

// Primary colors for shift types (for current user)
export const SHIFT_TYPE_COLORS: Record<ShiftType, string> = {
  days: '#2ECC71',      // Green for user
  nights: '#E74C3C',    // Red for user
  afternoons: '#3498DB', // Blue for user
  morning: '#F39C12',   // Orange
  evening: '#9B59B6',   // Purple
  custom: '#95A5A6',    // Gray
};

// Colors for OTHER users (not the current user)
export const OTHER_USER_COLORS: Record<ShiftType, string> = {
  days: '#5DADE2',      // Light blue when other user works days
  nights: '#F4D03F',    // Yellow when other user works nights
  afternoons: '#AF7AC5', // Light purple when other user works afternoons
  morning: '#F8B739',   // Lighter orange
  evening: '#7FB3D5',   // Lighter blue
  custom: '#AAB7B8',    // Lighter gray
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
  // Group shifts by unique user (take first shift per user if multiple)
  const userShiftMap = new Map<string, Shift>();
  
  shiftsOnDate.forEach(shift => {
    if (!userShiftMap.has(shift.ownerId)) {
      userShiftMap.set(shift.ownerId, shift);
    }
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
    // Single person - show their shift color
    const shift = Array.from(userShiftMap.values())[0];
    const isCurrentUser = shift.ownerId === currentUserId;
    colors.push(getShiftColor(shift, currentUserId, isCurrentUser));
    
    return {
      userCount: 1,
      colors,
      displayStrategy: 'single',
      workingCount: 1,
    };
  } else if (userCount === 2) {
    // Two people - show both colors (current user first if present)
    const shifts = Array.from(userShiftMap.values());
    const currentUserShift = shifts.find(s => s.ownerId === currentUserId);
    const otherUserShift = shifts.find(s => s.ownerId !== currentUserId);
    
    if (currentUserShift) {
      colors.push(getShiftColor(currentUserShift, currentUserId, true));
    }
    if (otherUserShift) {
      colors.push(getShiftColor(otherUserShift, currentUserId, false));
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
    return 'nights';
  }
  
  // Afternoon/Evening shift: starts after 12:00 and before 20:00
  if (startHour >= 12 && startHour < 20) {
    return 'afternoons';
  }
  
  // Morning/Day shift: starts between 05:00 and 12:00
  if (startHour >= 5 && startHour < 12) {
    return 'days';
  }
  
  // Default to days for other times
  return 'days';
}

/**
 * Gets a user-friendly display name for shift type
 */
export function getShiftTypeDisplayName(shiftType: ShiftType): string {
  const displayNames: Record<ShiftType, string> = {
    days: 'Day Shift',
    nights: 'Night Shift',
    afternoons: 'Afternoon Shift',
    morning: 'Morning Shift',
    evening: 'Evening Shift',
    custom: 'Custom Shift',
  };
  
  return displayNames[shiftType];
}

/**
 * Gets shift type icon/emoji
 */
export function getShiftTypeIcon(shiftType: ShiftType): string {
  const icons: Record<ShiftType, string> = {
    days: '☀️',
    nights: '🌙',
    afternoons: '🌅',
    morning: '🌄',
    evening: '🌆',
    custom: '⭐',
  };
  
  return icons[shiftType];
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