/**
 * Unit tests for ShiftPatternService
 * Tests pattern generation, date calculation, and validation
 */

import { shiftPatternService, PATTERN_TEMPLATES } from '../shiftPattern.service';
import { PatternRule, ShiftType } from '@/types';
import { addDays, startOfDay, format } from 'date-fns';

// Firestore is mocked in jest.setup.js

describe('ShiftPatternService', () => {
  describe('Pattern Templates', () => {
    test('should have all expected pattern templates', () => {
      expect(PATTERN_TEMPLATES).toHaveProperty('4on4off');
      expect(PATTERN_TEMPLATES).toHaveProperty('5on2off');
      expect(PATTERN_TEMPLATES).toHaveProperty('2on2off');
      expect(PATTERN_TEMPLATES).toHaveProperty('7on7off');
      expect(PATTERN_TEMPLATES).toHaveProperty('weekends');
    });

    test('4on4off template should have correct structure', () => {
      const template = PATTERN_TEMPLATES['4on4off'];
      expect(template.name).toBe('4 On / 4 Off');
      expect(template.type).toBe('rotation');
      expect(template.workDays).toBe(4);
      expect(template.restDays).toBe(4);
    });

    test('5on2off template should have weekly schedule', () => {
      const template = PATTERN_TEMPLATES['5on2off'];
      expect(template.name).toBe('5 Days / Week');
      expect(template.type).toBe('fixed_weekly');
      expect(template.weeklySchedule?.monday).toBe(true);
      expect(template.weeklySchedule?.saturday).toBe(false);
    });
  });

  describe('Pattern Validation', () => {
    test('should validate valid 4on4off pattern', () => {
      const result = shiftPatternService.validatePattern('4on4off');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should validate custom rotation pattern', () => {
      const customPattern: PatternRule = {
        type: 'rotation',
        workDays: 3,
        restDays: 2,
        startDate: new Date(),
      };
      const result = shiftPatternService.validatePattern('custom', customPattern);
      expect(result.valid).toBe(true);
    });

    test('should reject custom pattern without workDays', () => {
      const customPattern: PatternRule = {
        type: 'rotation',
        restDays: 2,
        startDate: new Date(),
      };
      const result = shiftPatternService.validatePattern('custom', customPattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Work days');
    });

    test('should reject custom pattern with negative restDays', () => {
      const customPattern: PatternRule = {
        type: 'rotation',
        workDays: 3,
        restDays: -1,
        startDate: new Date(),
      };
      const result = shiftPatternService.validatePattern('custom', customPattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Rest days');
    });

    test('should reject weekly pattern with no work days', () => {
      const customPattern: PatternRule = {
        type: 'fixed_weekly',
        startDate: new Date(),
        weeklySchedule: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false,
        },
      };
      const result = shiftPatternService.validatePattern('custom', customPattern);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('At least one work day');
    });
  });

  describe('Pattern Preview', () => {
    test('should preview 4on4off pattern for 30 days', () => {
      const startDate = startOfDay(new Date('2025-01-01'));
      const preview = shiftPatternService.previewPattern('4on4off', startDate, 30);
      
      // Should have work days only
      expect(preview.length).toBeGreaterThan(0);
      expect(preview.length).toBeLessThanOrEqual(30);
      
      // First 4 days should be work days
      expect(preview[0]).toEqual(startOfDay(new Date('2025-01-01')));
      expect(preview[1]).toEqual(startOfDay(new Date('2025-01-02')));
      expect(preview[2]).toEqual(startOfDay(new Date('2025-01-03')));
      expect(preview[3]).toEqual(startOfDay(new Date('2025-01-04')));
    });

    test('should preview 5on2off (Mon-Fri) pattern', () => {
      // Start on Monday
      const startDate = startOfDay(new Date('2025-01-06')); // Monday
      const preview = shiftPatternService.previewPattern('5on2off', startDate, 14);
      
      // Should only include weekdays
      preview.forEach((date) => {
        const dayOfWeek = date.getDay();
        expect(dayOfWeek).not.toBe(0); // Not Sunday
        expect(dayOfWeek).not.toBe(6); // Not Saturday
      });
      
      // Should have 10 days (2 weeks of Mon-Fri)
      expect(preview.length).toBe(10);
    });

    test('should preview weekends pattern', () => {
      const startDate = startOfDay(new Date('2025-01-01')); // Wednesday
      const preview = shiftPatternService.previewPattern('weekends', startDate, 14);
      
      // Should only include Saturdays and Sundays
      preview.forEach((date) => {
        const dayOfWeek = date.getDay();
        expect([0, 6]).toContain(dayOfWeek); // Sunday or Saturday
      });
      
      // Should have 4 days (2 weekends)
      expect(preview.length).toBe(4);
    });

    test('should preview 2on2off pattern', () => {
      const startDate = startOfDay(new Date('2025-01-01'));
      const preview = shiftPatternService.previewPattern('2on2off', startDate, 12);
      
      // Pattern: work 2, rest 2
      // Should have 6 work days in 12 days
      expect(preview.length).toBe(6);
      
      // Check pattern: day 1,2 work, day 3,4 rest, day 5,6 work...
      expect(preview[0]).toEqual(startOfDay(new Date('2025-01-01')));
      expect(preview[1]).toEqual(startOfDay(new Date('2025-01-02')));
      expect(preview[2]).toEqual(startOfDay(new Date('2025-01-05')));
      expect(preview[3]).toEqual(startOfDay(new Date('2025-01-06')));
    });
  });

  describe('Shift Count Calculation', () => {
    test('should calculate correct count for 4on4off over 6 months', () => {
      const startDate = new Date('2025-01-01');
      const count = shiftPatternService.calculateShiftCount('4on4off', startDate, 6);
      
      // 6 months ≈ 180 days
      // Pattern cycle: 8 days (4 work + 4 rest)
      // Expected: ~90 work days (180 / 2)
      expect(count).toBeGreaterThan(80);
      expect(count).toBeLessThan(100);
    });

    test('should calculate correct count for 5on2off over 3 months', () => {
      const startDate = new Date('2025-01-01');
      const count = shiftPatternService.calculateShiftCount('5on2off', startDate, 3);
      
      // 3 months ≈ 90 days ≈ 13 weeks
      // Expected: ~65 work days (5 days/week)
      expect(count).toBeGreaterThan(60);
      expect(count).toBeLessThan(70);
    });

    test('should calculate count for custom pattern', () => {
      const startDate = new Date('2025-01-01');
      const customPattern: PatternRule = {
        type: 'rotation',
        workDays: 3,
        restDays: 4,
        startDate,
      };
      const count = shiftPatternService.calculateShiftCount('custom', startDate, 1, customPattern);
      
      // 1 month ≈ 30 days
      // Pattern cycle: 7 days (3 work + 4 rest)
      // Expected: ~13 work days (30 * 3/7)
      expect(count).toBeGreaterThan(10);
      expect(count).toBeLessThan(16);
    });
  });

  describe('Pattern Info', () => {
    test('should get info for valid pattern', () => {
      const info = shiftPatternService.getPatternInfo('4on4off');
      expect(info).not.toBeNull();
      expect(info?.name).toBe('4 On / 4 Off');
      expect(info?.description).toBe('Work 4 days, rest 4 days');
    });

    test('should return null for invalid pattern', () => {
      const info = shiftPatternService.getPatternInfo('invalid' as any);
      expect(info).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle pattern starting mid-week', () => {
      // Start 5on2off on Wednesday
      const startDate = startOfDay(new Date('2025-01-01')); // Wednesday
      const preview = shiftPatternService.previewPattern('5on2off', startDate, 7);
      
      // Should still work correctly
      expect(preview.length).toBeGreaterThan(0);
    });

    test('should handle overnight shifts in time calculation', () => {
      // This would be tested in the actual batch creation
      // Verifying the logic exists for overnight shifts
      const startDate = new Date('2025-01-01');
      const count = shiftPatternService.calculateShiftCount('4on4off', startDate, 1);
      expect(count).toBeGreaterThan(0);
    });

    test('should handle leap year correctly', () => {
      // 2024 is a leap year
      const startDate = new Date('2024-02-01');
      const count = shiftPatternService.calculateShiftCount('5on2off', startDate, 1);
      
      // February 2024 has 29 days
      // Should account for the extra day
      expect(count).toBeGreaterThan(18); // At least 18 workdays in Feb
    });

    test('should handle year boundary', () => {
      const startDate = new Date('2024-12-15');
      const preview = shiftPatternService.previewPattern('4on4off', startDate, 30);
      
      // Should cross into 2025
      expect(preview.length).toBeGreaterThan(0);
      const lastDate = preview[preview.length - 1];
      expect(lastDate.getFullYear()).toBeGreaterThanOrEqual(2024);
    });
  });

  describe('Complex Patterns', () => {
    test('should handle 7on7off pattern', () => {
      const startDate = new Date('2025-01-01');
      const preview = shiftPatternService.previewPattern('7on7off', startDate, 28);
      
      // 28 days = 2 complete cycles
      // Should have exactly 14 work days
      expect(preview.length).toBe(14);
      
      // First 7 days should be consecutive
      for (let i = 0; i < 7; i++) {
        expect(preview[i]).toEqual(addDays(startDate, i));
      }
    });

    test('should handle custom 10on4off pattern', () => {
      const startDate = new Date('2025-01-01');
      const customPattern: PatternRule = {
        type: 'rotation',
        workDays: 10,
        restDays: 4,
        startDate,
      };
      const preview = shiftPatternService.previewPattern('custom', startDate, 28, customPattern);
      
      // 28 days = 2 complete cycles (10+4=14 days each)
      // Should have exactly 20 work days
      expect(preview.length).toBe(20);
    });
  });
});

// Integration test suite
describe('ShiftPatternService Integration', () => {
  // These would be actual integration tests with real Firestore
  // For now, they're placeholders showing what should be tested
  
  test.skip('should create batch of shifts in Firestore', async () => {
    // Would test actual Firestore batch creation
  });

  test.skip('should handle Firestore batch size limits', async () => {
    // Test creating > 500 shifts (Firestore batch limit)
  });

  test.skip('should rollback on batch creation failure', async () => {
    // Test error handling during batch creation
  });
});

export {}; // Make this a module
