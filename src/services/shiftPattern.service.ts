import { Shift, ShiftType, PatternRule } from '@/types';
import { shiftService } from './shift.service';
import { addDays, addWeeks, startOfDay, format } from 'date-fns';

/**
 * Pattern Templates for common shift schedules
 */
export const PATTERN_TEMPLATES = {
  '4on4off': {
    name: '4 On / 4 Off',
    description: 'Work 4 days, rest 4 days',
    workDays: 4,
    restDays: 4,
    type: 'rotation' as const,
  },
  '5on2off': {
    name: '5 Days / Week',
    description: 'Monday to Friday',
    type: 'fixed_weekly' as const,
    weeklySchedule: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
  },
  '2on2off': {
    name: '2 On / 2 Off',
    description: 'Work 2 days, rest 2 days',
    workDays: 2,
    restDays: 2,
    type: 'rotation' as const,
  },
  '3on3off': {
    name: '3 On / 3 Off',
    description: 'Work 3 days, rest 3 days',
    workDays: 3,
    restDays: 3,
    type: 'rotation' as const,
  },
  '2on3off': {
    name: '2 On / 3 Off (Firefighter)',
    description: 'Work 2 days, rest 3 days',
    workDays: 2,
    restDays: 3,
    type: 'rotation' as const,
  },
  '7on7off': {
    name: '7 On / 7 Off (Week On/Off)',
    description: 'Work 1 week, rest 1 week',
    workDays: 7,
    restDays: 7,
    type: 'rotation' as const,
  },
  '4on2off': {
    name: '4 On / 2 Off',
    description: 'Work 4 days, rest 2 days',
    workDays: 4,
    restDays: 2,
    type: 'rotation' as const,
  },
  weekends: {
    name: 'Weekends Only',
    description: 'Saturday and Sunday',
    type: 'fixed_weekly' as const,
    weeklySchedule: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: true,
      sunday: true,
    },
  },
};

export type PatternTemplateKey = keyof typeof PATTERN_TEMPLATES;

interface GeneratePatternOptions {
  patternKey: PatternTemplateKey | 'custom';
  startDate: Date;
  shiftStartTime: string; // HH:mm format (e.g., "07:00")
  shiftEndTime: string; // HH:mm format (e.g., "19:00")
  title: string;
  householdId: string;
  ownerId: string;
  shiftType: ShiftType;
  notes?: string;
  customPattern?: PatternRule;
  durationMonths?: number; // How many months to generate (default 6)
}

interface BatchShiftResult {
  success: boolean;
  created: number;
  failed: number;
  errors: string[];
}

class ShiftPatternService {
  /**
   * Generate shifts from a pattern template
   */
  async generateShiftsFromPattern(
    options: GeneratePatternOptions
  ): Promise<BatchShiftResult> {
    const {
      patternKey,
      startDate,
      shiftStartTime,
      shiftEndTime,
      title,
      householdId,
      ownerId,
      shiftType,
      notes,
      durationMonths = 6,
    } = options;

    const result: BatchShiftResult = {
      success: true,
      created: 0,
      failed: 0,
      errors: [],
    };

    try {
      const endDate = addDays(startOfDay(startDate), durationMonths * 30);
      const shiftsToCreate: Omit<Shift, 'id'>[] = [];

      if (patternKey === 'custom') {
        // Handle custom patterns
        result.errors.push('Custom patterns not yet implemented');
        result.success = false;
        return result;
      }

      const template = PATTERN_TEMPLATES[patternKey];

      if (!template) {
        result.errors.push('Invalid pattern template');
        result.success = false;
        return result;
      }

      let currentDate = startOfDay(startDate);

      // Generate shifts based on pattern type
      if (template.type === 'rotation') {
        const { workDays = 0, restDays = 0 } = template as any;
        let dayCount = 0;
        let isWorkPeriod = true;

        while (currentDate < endDate) {
          const cycleDays = isWorkPeriod ? workDays : restDays;

          if (isWorkPeriod) {
            // Create shift for this work day
            shiftsToCreate.push(this.createShiftObject(
              currentDate,
              shiftStartTime,
              shiftEndTime,
              title,
              householdId,
              ownerId,
              shiftType,
              notes
            ));
          }

          dayCount++;
          if (dayCount >= cycleDays) {
            dayCount = 0;
            isWorkPeriod = !isWorkPeriod;
          }

          currentDate = addDays(currentDate, 1);
        }
      } else if (template.type === 'fixed_weekly') {
        const { weeklySchedule } = template as any;
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        while (currentDate < endDate) {
          const dayOfWeek = currentDate.getDay();
          const dayName = dayNames[dayOfWeek];

          if (weeklySchedule[dayName]) {
            shiftsToCreate.push(this.createShiftObject(
              currentDate,
              shiftStartTime,
              shiftEndTime,
              title,
              householdId,
              ownerId,
              shiftType,
              notes
            ));
          }

          currentDate = addDays(currentDate, 1);
        }
      }

      // Create all shifts
      for (const shiftData of shiftsToCreate) {
        try {
          await shiftService.createShift(shiftData);
          result.created++;
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Failed to create shift on ${format(shiftData.startTime as Date, 'yyyy-MM-dd')}: ${error.message}`);
        }
      }

      result.success = result.failed === 0;
      return result;
    } catch (error: any) {
      console.error('Error generating shifts from pattern:', error);
      result.success = false;
      result.errors.push(error.message || 'Unknown error');
      return result;
    }
  }

  /**
   * Create a shift object
   */
  private createShiftObject(
    date: Date,
    startTime: string,
    endTime: string,
    title: string,
    householdId: string,
    ownerId: string,
    shiftType: ShiftType,
    notes?: string
  ): Omit<Shift, 'id'> {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startDateTime = new Date(date);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const endDateTime = new Date(date);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    // If end time is before start time, assume it's next day
    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    return {
      title,
      startTime: startDateTime,
      endTime: endDateTime,
      householdId,
      ownerId,
      shiftType,
      colorTag: '#000000', // Will be set by shiftService
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedBy: ownerId,
    };
  }

  /**
   * Get pattern information
   */
  getPatternInfo(patternKey: PatternTemplateKey): {
    name: string;
    description: string;
  } {
    const template = PATTERN_TEMPLATES[patternKey];
    return {
      name: template.name,
      description: template.description,
    };
  }

  /**
   * Get all available pattern templates
   */
  getAvailablePatterns(): Array<{
    key: PatternTemplateKey;
    name: string;
    description: string;
  }> {
    return Object.entries(PATTERN_TEMPLATES).map(([key, template]) => ({
      key: key as PatternTemplateKey,
      name: template.name,
      description: template.description,
    }));
  }
}

export const shiftPatternService = new ShiftPatternService();
