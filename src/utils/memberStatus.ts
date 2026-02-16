import { Shift } from '@/types';
import { isWithinInterval, parseISO } from 'date-fns';

export type MemberStatus = 'available' | 'working' | 'busy';

export interface MemberStatusInfo {
  status: MemberStatus;
  color: string;
  label: string;
  currentShift?: Shift;
  reason?: string; // Why they're busy (e.g., "Working: Night Shift", "Appointment: Doctor Visit")
}

/**
 * Determine member's REAL-TIME status based on their calendar for TODAY
 * Checks all events: shifts, appointments, etc.
 * 
 * Status Rules (in priority order):
 * 1. RED (WORKING) = An active shift for this person RIGHT NOW
 * 2. YELLOW (BUSY) = Appointment/event/shift starting within next 2 hours for this person
 * 3. GREEN (AVAILABLE) = No shifts, no appointments for this person
 */
export const getMemberStatus = (userId: string, shifts: Shift[]): MemberStatusInfo => {
  const now = new Date();
  
  // Find all calendar items (shifts, appointments, events) for this specific user TODAY
  const userCalendarItems = shifts.filter(
    shift => shift.ownerId === userId && !shift.isDeleted
  );
  
  // PRIORITY 1: Check for ACTIVE shift RIGHT NOW (RED - WORKING)
  for (const item of userCalendarItems) {
    const itemStart = convertToDate(item.startTime);
    const itemEnd = convertToDate(item.endTime);
    
    // Is this calendar item happening right now?
    if (isWithinInterval(now, { start: itemStart, end: itemEnd })) {
      const label = item.shiftType ? item.shiftType.toUpperCase() : 'SHIFT';
      return {
        status: 'working',
        color: '#EF4444', // Red
        label: `Working: ${item.title}`,
        currentShift: item,
        reason: `${label} - ${formatTime(itemStart)} to ${formatTime(itemEnd)}`,
      };
    }
  }
  
  // PRIORITY 2: Check for UPCOMING calendar items in next 2 hours (YELLOW - BUSY)
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  
  for (const item of userCalendarItems) {
    const itemStart = convertToDate(item.startTime);
    
    // Is this calendar item starting within next 2 hours?
    if (isWithinInterval(itemStart, { start: now, end: twoHoursFromNow })) {
      const label = item.shiftType ? item.shiftType.toUpperCase() : 'EVENT';
      return {
        status: 'busy',
        color: '#F59E0B', // Yellow/Amber
        label: `Busy: ${item.title}`,
        currentShift: item,
        reason: `${label} in ${getMinutesUntil(itemStart)} minutes`,
      };
    }
  }
  
  // PRIORITY 3: No active or upcoming items (GREEN - AVAILABLE)
  return {
    status: 'available',
    color: '#10B981', // Green
    label: 'Available',
  };
};

/**
 * Helper: Convert Firestore timestamp or Date to Date object
 */
const convertToDate = (time: any): Date => {
  if (time instanceof Date) {
    return time;
  }
  if (time && typeof time === 'object' && 'seconds' in time) {
    return new Date(time.seconds * 1000);
  }
  return new Date(time);
};

/**
 * Helper: Format time as HH:MM
 */
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Helper: Get minutes until a future time
 */
const getMinutesUntil = (futureDate: Date): number => {
  const now = new Date();
  const diff = futureDate.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60));
};

/**
 * Get color for a member's status
 */
export const getStatusColor = (status: MemberStatus): string => {
  switch (status) {
    case 'available':
      return '#10B981'; // Green
    case 'working':
      return '#EF4444'; // Red
    case 'busy':
      return '#F59E0B'; // Amber/Yellow
    default:
      return '#6B7280'; // Gray
  }
};

/**
 * Get label for a member's status
 */
export const getStatusLabel = (status: MemberStatus): string => {
  switch (status) {
    case 'available':
      return 'Available';
    case 'working':
      return 'Working';
    case 'busy':
      return 'Busy';
    default:
      return 'Unknown';
  }
};
