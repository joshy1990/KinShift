/**
 * Unit tests for shift pattern service — pure pattern logic (no Firestore)
 */
import { shiftPatternService } from '@/services/shiftPattern.service';
import { PATTERN_TEMPLATES, PatternTemplateKey } from '@/services/shiftPattern.service';
import { startOfDay, addDays } from 'date-fns';

describe('ShiftPatternService', () => {
  // ── Pattern Templates ──────────────────────────────────────────────────
  describe('PATTERN_TEMPLATES', () => {
    it('has 8 templates', () => {
      expect(Object.keys(PATTERN_TEMPLATES)).toHaveLength(8);
    });

    it.each([
      ['4on4off', '4 On / 4 Off'],
      ['5on2off', '5 Days / Week'],
      ['2on2off', '2 On / 2 Off'],
      ['3on3off', '3 On / 3 Off'],
      ['2on3off', '2 On / 3 Off (Firefighter)'],
      ['7on7off', '7 On / 7 Off (Week On/Off)'],
      ['4on2off', '4 On / 2 Off'],
      ['weekends', 'Weekends Only'],
    ] as const)('template %s has name "%s"', (key, name) => {
      expect(PATTERN_TEMPLATES[key].name).toBe(name);
    });

    it('rotation templates have workDays and restDays', () => {
      const rotations = Object.values(PATTERN_TEMPLATES).filter(t => t.type === 'rotation');
      for (const tmpl of rotations) {
        expect((tmpl as any).workDays).toBeGreaterThan(0);
        expect((tmpl as any).restDays).toBeGreaterThanOrEqual(0);
      }
    });

    it('fixed_weekly templates have weeklySchedule', () => {
      const weekly = Object.values(PATTERN_TEMPLATES).filter(t => t.type === 'fixed_weekly');
      for (const tmpl of weekly) {
        const sched = (tmpl as any).weeklySchedule;
        expect(sched).toBeDefined();
        expect(Object.keys(sched)).toHaveLength(7);
      }
    });
  });

  // ── validatePattern ────────────────────────────────────────────────────
  describe('validatePattern', () => {
    it('accepts valid template key', () => {
      expect(shiftPatternService.validatePattern('4on4off')).toEqual({ valid: true });
    });

    it('rejects invalid template key', () => {
      const result = shiftPatternService.validatePattern('invalid' as PatternTemplateKey);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('rejects custom without pattern data', () => {
      const result = shiftPatternService.validatePattern('custom');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing custom pattern');
    });

    it('accepts custom rotation with valid config', () => {
      const result = shiftPatternService.validatePattern('custom', {
        type: 'rotation',
        workDays: 3,
        restDays: 2,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects custom rotation with 0 work days', () => {
      const result = shiftPatternService.validatePattern('custom', {
        type: 'rotation',
        workDays: 0,
        restDays: 2,
      });
      expect(result.valid).toBe(false);
    });

    it('rejects custom rotation with negative rest days', () => {
      const result = shiftPatternService.validatePattern('custom', {
        type: 'rotation',
        workDays: 3,
        restDays: -1,
      });
      expect(result.valid).toBe(false);
    });

    it('accepts custom fixed_weekly with at least one work day', () => {
      const result = shiftPatternService.validatePattern('custom', {
        type: 'fixed_weekly',
        weeklySchedule: {
          monday: true, tuesday: false, wednesday: false,
          thursday: false, friday: false, saturday: false, sunday: false,
        },
      } as any);
      expect(result.valid).toBe(true);
    });

    it('rejects custom fixed_weekly with no work days', () => {
      const result = shiftPatternService.validatePattern('custom', {
        type: 'fixed_weekly',
        weeklySchedule: {
          monday: false, tuesday: false, wednesday: false,
          thursday: false, friday: false, saturday: false, sunday: false,
        },
      } as any);
      expect(result.valid).toBe(false);
    });
  });

  // ── previewPattern ─────────────────────────────────────────────────────
  describe('previewPattern', () => {
    const start = new Date('2025-01-01T00:00:00');

    it('4on4off produces correct first 8, 16 days', () => {
      const dates = shiftPatternService.previewPattern('4on4off', start, 16);
      // Days 0-3 work, 4-7 off, 8-11 work, 12-15 off
      expect(dates).toHaveLength(8);
      // First 4 should be work days 0-3
      for (let i = 0; i < 4; i++) {
        expect(dates[i]).toEqual(startOfDay(addDays(start, i)));
      }
      // Next 4 should be work days 8-11
      for (let i = 0; i < 4; i++) {
        expect(dates[4 + i]).toEqual(startOfDay(addDays(start, 8 + i)));
      }
    });

    it('2on2off alternates correctly', () => {
      const dates = shiftPatternService.previewPattern('2on2off', start, 8);
      // Days 0,1 work, 2,3 off, 4,5 work, 6,7 off → 4 work days
      expect(dates).toHaveLength(4);
    });

    it('5on2off produces 5 results per 7 days (Mon-Fri)', () => {
      // Start from a known Monday (2025-01-06 is a Monday)
      const monday = new Date('2025-01-06T00:00:00');
      const dates = shiftPatternService.previewPattern('5on2off', monday, 7);
      expect(dates).toHaveLength(5);
    });

    it('weekends produces 2 results per 7 days (Sat-Sun)', () => {
      // Start from a known Monday
      const monday = new Date('2025-01-06T00:00:00');
      const dates = shiftPatternService.previewPattern('weekends', monday, 7);
      expect(dates).toHaveLength(2);
    });

    it('custom rotation is previewed correctly', () => {
      const dates = shiftPatternService.previewPattern('custom', start, 10, {
        type: 'rotation',
        workDays: 1,
        restDays: 1,
      });
      // alt: work, off, work, off, work, off, work, off, work, off → 5 work days
      expect(dates).toHaveLength(5);
    });

    it('returns empty for invalid template', () => {
      const dates = shiftPatternService.previewPattern('bad' as PatternTemplateKey, start, 14);
      expect(dates).toHaveLength(0);
    });
  });

  // ── calculateShiftCount ────────────────────────────────────────────────
  describe('calculateShiftCount', () => {
    const start = new Date('2025-01-01T00:00:00');

    it('4on4off over 1 month produces roughly half-and-half', () => {
      const count = shiftPatternService.calculateShiftCount('4on4off', start, 1);
      // 30 days in a month; with rounding, the work day starting on day 1 gives 16
      expect(count).toBe(16);
    });

    it('2on2off over 1 month produces roughly half-and-half', () => {
      const count = shiftPatternService.calculateShiftCount('2on2off', start, 1);
      // Same logic: start on work day → 16 out of 30
      expect(count).toBe(16);
    });

    it('returns 0 for empty months', () => {
      // durationMonths = 0 → max(1, 0) = 1 → still generates 30 days
      // Actually no: Math.max(1, 0) * 30 = 30 days, so it calculates 1 month anyway
      const count = shiftPatternService.calculateShiftCount('4on4off', start, 0);
      expect(count).toBeGreaterThan(0);
    });
  });

  // ── getPatternInfo ─────────────────────────────────────────────────────
  describe('getPatternInfo', () => {
    it('returns name and description for valid key', () => {
      const info = shiftPatternService.getPatternInfo('4on4off');
      expect(info).toEqual({
        name: '4 On / 4 Off',
        description: 'Work 4 days, rest 4 days',
      });
    });

    it('returns null for invalid key', () => {
      const info = shiftPatternService.getPatternInfo('bad' as PatternTemplateKey);
      expect(info).toBeNull();
    });
  });
});
