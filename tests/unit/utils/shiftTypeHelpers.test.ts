/**
 * Unit tests for shift type helper utilities
 */
import {
  getShiftTypeColor,
  getShiftTypeLabel,
  getShiftTypeName,
  getShiftTypeEmoji,
  isWorkingShift,
  requiresStartEndTime,
  getAllShiftTypes,
  getQuickShiftTypes,
  getTextColorForBackground,
  getShiftTypeDescription,
  canShiftsCoexist,
  sortShiftTypes,
} from '@/utils/shiftTypeHelpers';
import { ShiftType } from '@/types';

describe('shiftTypeHelpers', () => {
  describe('getShiftTypeColor', () => {
    it('returns a color string for every known shift type', () => {
      const types: ShiftType[] = ['day', 'night', 'twilight', 'split', 'holiday', 'off', 'sick', 'training', 'custom'];
      for (const t of types) {
        const color = getShiftTypeColor(t);
        expect(color).toBeTruthy();
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('returns fallback for unknown type', () => {
      const color = getShiftTypeColor('nonexistent' as ShiftType);
      expect(color).toBeTruthy();
    });
  });

  describe('getShiftTypeLabel', () => {
    it('returns short label for day shift', () => {
      expect(getShiftTypeLabel('day')).toBe('D');
    });

    it('returns fallback for unknown type', () => {
      expect(getShiftTypeLabel('nonexistent' as ShiftType)).toBe('C');
    });
  });

  describe('getShiftTypeName', () => {
    it('returns full name for known types', () => {
      expect(getShiftTypeName('night')).toBe('Night Shift');
      expect(getShiftTypeName('holiday')).toBe('Holiday');
    });

    it('returns Custom for unknown type', () => {
      expect(getShiftTypeName('nonexistent' as ShiftType)).toBe('Custom');
    });
  });

  describe('getShiftTypeEmoji', () => {
    it('returns emoji for known types', () => {
      expect(getShiftTypeEmoji('day')).toBeTruthy();
      expect(getShiftTypeEmoji('night')).toBeTruthy();
    });
  });

  describe('isWorkingShift', () => {
    it('returns true for working shift types', () => {
      expect(isWorkingShift('day')).toBe(true);
      expect(isWorkingShift('night')).toBe(true);
      expect(isWorkingShift('twilight')).toBe(true);
      expect(isWorkingShift('split')).toBe(true);
      expect(isWorkingShift('training')).toBe(true);
    });

    it('returns false for non-working shift types', () => {
      expect(isWorkingShift('holiday')).toBe(false);
      expect(isWorkingShift('off')).toBe(false);
      expect(isWorkingShift('sick')).toBe(false);
    });
  });

  describe('requiresStartEndTime', () => {
    it('returns true for shifts needing times', () => {
      expect(requiresStartEndTime('day')).toBe(true);
      expect(requiresStartEndTime('night')).toBe(true);
      expect(requiresStartEndTime('twilight')).toBe(true);
      expect(requiresStartEndTime('split')).toBe(true);
      expect(requiresStartEndTime('sick')).toBe(true);
      expect(requiresStartEndTime('training')).toBe(true);
    });

    it('returns false for all-day shift types', () => {
      expect(requiresStartEndTime('holiday')).toBe(false);
      expect(requiresStartEndTime('off')).toBe(false);
      expect(requiresStartEndTime('custom')).toBe(false);
    });
  });

  describe('getAllShiftTypes', () => {
    it('returns all 9 shift types', () => {
      const types = getAllShiftTypes();
      expect(types).toHaveLength(9);
      expect(types).toContain('day');
      expect(types).toContain('night');
      expect(types).toContain('custom');
    });
  });

  describe('getQuickShiftTypes', () => {
    it('returns exactly 3 quick-access types', () => {
      const types = getQuickShiftTypes();
      expect(types).toHaveLength(3);
      expect(types).toEqual(['day', 'night', 'twilight']);
    });
  });

  describe('getTextColorForBackground', () => {
    it('returns dark for light backgrounds', () => {
      expect(getTextColorForBackground('#FFFFFF')).toBe('dark');
      expect(getTextColorForBackground('#FFFF00')).toBe('dark');
    });

    it('returns light for dark backgrounds', () => {
      expect(getTextColorForBackground('#000000')).toBe('light');
      expect(getTextColorForBackground('#1A1A2E')).toBe('light');
    });
  });

  describe('getShiftTypeDescription', () => {
    it('returns description for all known types', () => {
      const types = getAllShiftTypes();
      for (const t of types) {
        const desc = getShiftTypeDescription(t);
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe('string');
      }
    });
  });

  describe('canShiftsCoexist', () => {
    it('allows split shifts to coexist with anything', () => {
      expect(canShiftsCoexist('split', 'day')).toBe(true);
      expect(canShiftsCoexist('day', 'split')).toBe(true);
      expect(canShiftsCoexist('split', 'holiday')).toBe(true);
    });

    it('disallows all-day types with working shifts', () => {
      expect(canShiftsCoexist('holiday', 'day')).toBe(false);
      expect(canShiftsCoexist('off', 'night')).toBe(false);
      expect(canShiftsCoexist('sick', 'twilight')).toBe(false);
    });

    it('disallows two regular working shifts together', () => {
      expect(canShiftsCoexist('day', 'night')).toBe(false);
      expect(canShiftsCoexist('day', 'day')).toBe(false);
    });
  });

  describe('sortShiftTypes', () => {
    it('sorts types in standard order', () => {
      const input: ShiftType[] = ['custom', 'day', 'off', 'night'];
      const sorted = sortShiftTypes(input);
      expect(sorted).toEqual(['day', 'night', 'off', 'custom']);
    });
  });
});
