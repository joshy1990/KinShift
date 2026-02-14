/**
 * Unit tests for core types — mapLegacyShiftType and SHIFT_COLORS
 */
import { mapLegacyShiftType, ShiftType, LegacyShiftType, SHIFT_COLORS } from '@/types';

describe('types/index', () => {
  describe('mapLegacyShiftType', () => {
    it.each<[LegacyShiftType, ShiftType]>([
      ['days', 'day'],
      ['nights', 'night'],
      ['afternoons', 'twilight'],
      ['morning', 'day'],
      ['evening', 'twilight'],
    ])('maps "%s" → "%s"', (legacy, expected) => {
      expect(mapLegacyShiftType(legacy)).toBe(expected);
    });

    it('returns "day" as fallback for unknown input', () => {
      // TypeScript won't allow this but runtime safety matters
      expect(mapLegacyShiftType('unknown' as LegacyShiftType)).toBe('day');
    });
  });

  describe('SHIFT_COLORS', () => {
    it('is an array with at least 9 palette colors', () => {
      expect(Array.isArray(SHIFT_COLORS)).toBe(true);
      expect(SHIFT_COLORS.length).toBeGreaterThanOrEqual(9);
    });

    it('all colors are valid hex codes', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      for (const color of SHIFT_COLORS) {
        expect(color).toMatch(hexRegex);
      }
    });
  });
});
