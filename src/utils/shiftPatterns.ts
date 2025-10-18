import { addDays, differenceInDays, format, startOfDay, isSameDay } from 'date-fns';

export interface ShiftEntry {
  date: Date;
  type: 'day' | 'night' | 'off';
  startTime?: string;
  endTime?: string;
  title?: string;
}

export interface ShiftPattern {
  id: string;
  name: string;
  description: string;
  cycle: ShiftEntry[];
  cycleDays: number;
  confidence: number; // How confident we are this is the pattern (0-1)
}

export interface DetectedPattern {
  pattern: ShiftPattern;
  nextShifts: ShiftEntry[];
  totalShiftsToGenerate: number;
}

// Common shift patterns that people use
export const COMMON_PATTERNS = {
  '4ON4OFF_DAYS': {
    name: '4 Days On, 4 Off',
    description: '4 day shifts, then 4 days off',
    cycle: [
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
    ],
    cycleDays: 8
  },
  '4ON4OFF_NIGHTS': {
    name: '4 Nights On, 4 Off',
    description: '4 night shifts, then 4 days off',
    cycle: [
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
    ],
    cycleDays: 8
  },
  '2DAY4NIGHT4OFF': {
    name: '2 Days, 4 Nights, 4 Off',
    description: '2 day shifts, 4 night shifts, then 4 days off',
    cycle: [
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'night', startTime: '20:00', endTime: '06:00' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
    ],
    cycleDays: 10
  },
  '3ON3OFF': {
    name: '3 On, 3 Off',
    description: '3 day shifts, then 3 days off',
    cycle: [
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'day', startTime: '08:00', endTime: '18:00' },
      { type: 'off' },
      { type: 'off' },
      { type: 'off' },
    ],
    cycleDays: 6
  }
} as const;

/**
 * Analyzes user's shift entries to detect patterns
 */
export function detectShiftPattern(shifts: ShiftEntry[]): DetectedPattern | null {
  if (shifts.length < 3) {
    return null; // Need at least 3 entries to detect a pattern
  }

  // Sort shifts by date
  const sortedShifts = shifts.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Try to detect various cycle lengths (3-14 days are common)
  for (let cycleLength = 3; cycleLength <= 14; cycleLength++) {
    const pattern = tryDetectCycle(sortedShifts, cycleLength);
    if (pattern && pattern.confidence > 0.7) {
      return {
        pattern,
        nextShifts: generateNextShifts(pattern, sortedShifts[sortedShifts.length - 1].date),
        totalShiftsToGenerate: 365 // Generate for the next year
      };
    }
  }

  return null;
}

/**
 * Try to detect a repeating cycle of given length
 */
function tryDetectCycle(shifts: ShiftEntry[], cycleLength: number): ShiftPattern | null {
  if (shifts.length < cycleLength * 1.5) {
    return null; // Need at least 1.5 cycles to be confident
  }

  const firstCycle = shifts.slice(0, cycleLength);
  let matches = 0;
  let totalChecked = 0;

  // Check if the pattern repeats in subsequent cycles
  for (let i = cycleLength; i < shifts.length; i++) {
    const cyclePosition = i % cycleLength;
    const expectedShift = firstCycle[cyclePosition];
    const actualShift = shifts[i];

    totalChecked++;
    
    // Check if shift types match (allowing for slight time variations)
    if (actualShift.type === expectedShift.type) {
      // For work shifts, also check if times are similar (within 1 hour)
      if (expectedShift.type !== 'off') {
        if (actualShift.startTime && expectedShift.startTime) {
          const timeDiff = Math.abs(
            parseTime(actualShift.startTime) - parseTime(expectedShift.startTime)
          );
          if (timeDiff <= 60) { // Within 1 hour
            matches++;
          }
        } else {
          matches += 0.5; // Partial match if times not specified
        }
      } else {
        matches++; // Off days always match
      }
    }
  }

  const confidence = matches / totalChecked;
  
  if (confidence > 0.7) {
    return {
      id: `detected_${cycleLength}_${Date.now()}`,
      name: generatePatternName(firstCycle),
      description: generatePatternDescription(firstCycle),
      cycle: firstCycle.map((shift, index) => ({
        ...shift,
        date: addDays(new Date(), index) // Normalize dates
      })),
      cycleDays: cycleLength,
      confidence
    };
  }

  return null;
}

/**
 * Generate future shifts based on detected pattern
 */
function generateNextShifts(pattern: ShiftPattern, lastDate: Date): ShiftEntry[] {
  const futureShifts: ShiftEntry[] = [];
  const startDate = addDays(lastDate, 1);
  
  // Generate shifts for the next year
  for (let dayOffset = 0; dayOffset < 365; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    const cyclePosition = dayOffset % pattern.cycleDays;
    const templateShift = pattern.cycle[cyclePosition];
    
    if (templateShift.type !== 'off') {
      futureShifts.push({
        date: currentDate,
        type: templateShift.type,
        startTime: templateShift.startTime,
        endTime: templateShift.endTime,
        title: `${templateShift.type === 'day' ? 'Day' : 'Night'} Shift`
      });
    }
  }
  
  return futureShifts;
}

/**
 * Generate a human-readable name for the pattern
 */
function generatePatternName(cycle: ShiftEntry[]): string {
  const workDays = cycle.filter(s => s.type !== 'off').length;
  const offDays = cycle.filter(s => s.type === 'off').length;
  
  const dayShifts = cycle.filter(s => s.type === 'day').length;
  const nightShifts = cycle.filter(s => s.type === 'night').length;
  
  if (dayShifts > 0 && nightShifts > 0) {
    return `${dayShifts} Days, ${nightShifts} Nights, ${offDays} Off`;
  } else if (dayShifts > 0) {
    return `${workDays} Days On, ${offDays} Off`;
  } else {
    return `${workDays} Nights On, ${offDays} Off`;
  }
}

/**
 * Generate a description for the pattern
 */
function generatePatternDescription(cycle: ShiftEntry[]): string {
  const workDays = cycle.filter(s => s.type !== 'off').length;
  const offDays = cycle.filter(s => s.type === 'off').length;
  const totalDays = cycle.length;
  
  return `${workDays} work days, ${offDays} days off, repeating every ${totalDays} days`;
}

/**
 * Parse time string to minutes since midnight
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get suggested patterns based on partial input
 */
export function getSuggestedPatterns(partialShifts: ShiftEntry[]): ShiftPattern[] {
  const suggestions: ShiftPattern[] = [];
  
  // Add common patterns
  Object.entries(COMMON_PATTERNS).forEach(([key, template]) => {
    suggestions.push({
      id: key,
      name: template.name,
      description: template.description,
      cycle: template.cycle.map((shift, index) => ({
        ...shift,
        date: addDays(new Date(), index)
      })) as ShiftEntry[],
      cycleDays: template.cycleDays,
      confidence: 0.9 // High confidence for pre-defined patterns
    });
  });
  
  return suggestions;
}

/**
 * Quick pattern detection for immediate feedback
 */
export function quickPatternCheck(shifts: ShiftEntry[]): string | null {
  if (shifts.length < 2) return null;
  
  const types = shifts.map(s => s.type);
  const pattern = types.join('-');
  
  // Quick pattern recognition for immediate feedback
  if (pattern.includes('day-day-day-day-off-off-off-off')) {
    return '4 Days On, 4 Off pattern detected';
  }
  if (pattern.includes('night-night-night-night-off-off-off-off')) {
    return '4 Nights On, 4 Off pattern detected';
  }
  if (pattern.includes('day-day-night-night-night-night-off-off-off-off')) {
    return '2 Days, 4 Nights, 4 Off pattern detected';
  }
  if (pattern.includes('day-day-day-off-off-off')) {
    return '3 On, 3 Off pattern detected';
  }
  
  return null;
}