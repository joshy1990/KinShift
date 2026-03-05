import {format, addDays, isSameDay} from 'date-fns';
import {Shift, ShiftType} from '@/types';

// Helper functions extracted from TwoWeekViewScreen for testing

/** Safely convert a Firestore Timestamp or Date-like value to a JS Date */
const toSafeDate = (value: any): Date => {
  if (value?.toDate) return value.toDate();
  return new Date(value);
};

export const getShiftsForUserAndDate = (
  shifts: Shift[],
  userId: string,
  date: Date
): Shift[] => {
  return shifts.filter(shift => 
    shift.ownerId === userId &&
    isSameDay(toSafeDate(shift.startTime), date)
  );
};

export const analyzeCoverage = (
  shifts: Shift[],
  date: Date
): {
  working: number;
  gap: boolean;
  overlap: boolean;
} => {
  const shiftsOnDate = shifts.filter(shift =>
    isSameDay(toSafeDate(shift.startTime), date)
  );
  
  const uniqueUsers = new Set(shiftsOnDate.map(s => s.ownerId));
  const working = uniqueUsers.size;
  
  return {
    working,
    gap: working === 0,
    overlap: working > 1,
  };
};

export const getUserInitials = (name: string): string => {
  const names = name.split(' ');
  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }
  return names[0][0].toUpperCase();
};

export const generateDateRange = (startDate: Date, days: number): Date[] => {
  return Array.from({length: days}, (_, i) => addDays(startDate, i));
};

export const countCoverageGaps = (shifts: Shift[], dateRange: Date[]): number => {
  return dateRange.filter(date => {
    const coverage = analyzeCoverage(shifts, date);
    return coverage.gap;
  }).length;
};

export const countCoverageOverlaps = (shifts: Shift[], dateRange: Date[]): number => {
  return dateRange.filter(date => {
    const coverage = analyzeCoverage(shifts, date);
    return coverage.overlap;
  }).length;
};
