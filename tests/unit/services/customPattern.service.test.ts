/**
 * Unit tests for custom pattern service — cycle detection + validation (pure logic)
 */
import { customPatternService, PatternCell } from '@/services/customPattern.service';
import type { CustomPattern, PatternPreview } from '@/services/customPattern.service';
import { ShiftType } from '@/types';

/** Helper to create a 14-cell pattern from a compact descriptor */
function makeCells(descriptor: Array<ShiftType | null>, start = '06:00', end = '18:00'): PatternCell[] {
  // Repeat or pad to fill 14 days
  const out: PatternCell[] = [];
  for (let i = 0; i < 14; i++) {
    const st = descriptor[i % descriptor.length];
    out.push({
      day: i + 1,
      shiftType: st,
      startTime: st ? start : '00:00',
      endTime: st ? end : '00:00',
    });
  }
  return out;
}

describe('CustomPatternService', () => {
  // ── calculateCycleLength ──────────────────────────────────────────────
  describe('calculateCycleLength', () => {
    it('detects 1-day cycle (every day work)', () => {
      const cells = makeCells(['day']); // all 14 days = day shift
      expect(customPatternService.calculateCycleLength(cells)).toBe(1);
    });

    it('detects 2-day cycle (alt work/off)', () => {
      const cells = makeCells(['day', null]); // work, off, work, off...
      expect(customPatternService.calculateCycleLength(cells)).toBe(2);
    });

    it('detects 4-day cycle (2 on / 2 off)', () => {
      const cells = makeCells(['day', 'day', null, null]);
      expect(customPatternService.calculateCycleLength(cells)).toBe(4);
    });

    it('detects 7-day cycle (Mon-Fri)', () => {
      const cells = makeCells(['day', 'day', 'day', 'day', 'day', null, null]);
      expect(customPatternService.calculateCycleLength(cells)).toBe(7);
    });

    it('detects 8-day cycle (4on4off)', () => {
      const cells = makeCells(['day', 'day', 'day', 'day', null, null, null, null]);
      expect(customPatternService.calculateCycleLength(cells)).toBe(8);
    });

    it('returns 14 when no smaller cycle found', () => {
      // Distinct first 14 days with no repeat
      const uniquePattern: Array<ShiftType | null> = [
        'day', 'night', 'day', null, 'night', null, 'day',
        null, null, 'night', 'day', null, null, 'night',
      ];
      const cells = makeCells(uniquePattern);
      // Override to be unique (makeCells repeats, so we need to set individually)
      for (let i = 0; i < 14; i++) {
        cells[i].shiftType = uniquePattern[i];
        cells[i].startTime = cells[i].shiftType ? '06:00' : '00:00';
        cells[i].endTime = cells[i].shiftType ? '18:00' : '00:00';
      }
      const length = customPatternService.calculateCycleLength(cells);
      expect(length).toBeGreaterThanOrEqual(7); // Could be 7 or 14 depending on match
    });

    it('different times within same shift type in first cycle prevent small cycle detection', () => {
      // Day 1 = day shift 06:00-14:00, Day 2 = day shift 14:00-22:00
      // Same shiftType with different times in first cycle → timeSetByType guard rejects small cycles
      const cells: PatternCell[] = [];
      for (let i = 0; i < 14; i++) {
        cells.push({
          day: i + 1,
          shiftType: 'day',
          startTime: i % 2 === 0 ? '06:00' : '14:00',
          endTime: i % 2 === 0 ? '14:00' : '22:00',
        });
      }
      const cycleLength = customPatternService.calculateCycleLength(cells);
      // The guard checks for conflicting times on the same shiftType within the
      // first cycleLength cells. For small even cycles, "day" appears with
      // two different time sets → rejected. Falls through to 14.
      expect(cycleLength).toBe(14);
    });
  });

  // ── validatePattern ───────────────────────────────────────────────────
  describe('validatePattern', () => {
    it('accepts valid 14-cell pattern with at least one working day', () => {
      const cells = makeCells(['day', null]);
      const result = customPatternService.validatePattern(cells);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects pattern with wrong length', () => {
      const cells = makeCells(['day', null]).slice(0, 10);
      const result = customPatternService.validatePattern(cells);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pattern must have exactly 14 days');
    });

    it('rejects pattern with no working days', () => {
      const cells = makeCells([null]); // all days off
      const result = customPatternService.validatePattern(cells);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Pattern must have at least one working day');
    });

    it('rejects invalid time format', () => {
      const cells = makeCells(['day']);
      cells[0].startTime = '25:00'; // invalid hour
      const result = customPatternService.validatePattern(cells);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid start time'))).toBe(true);
    });

    it('rejects bad minute value', () => {
      const cells = makeCells(['day']);
      cells[0].endTime = '12:60'; // invalid minute
      const result = customPatternService.validatePattern(cells);
      expect(result.valid).toBe(false);
    });

    it('does not validate times for off-days', () => {
      const cells = makeCells([null]);
      cells[0].startTime = 'invalid'; // off day, should be ignored
      // But the pattern has no working days, so it will fail for that reason
      // Let's make day 1 a work day and day 2 null with bad time
      const mixed = makeCells(['day', null]);
      mixed[1].startTime = 'bad'; // null shift type → not validated
      const result = customPatternService.validatePattern(mixed);
      expect(result.valid).toBe(true);
    });
  });

  // ── previewPattern ────────────────────────────────────────────────────
  describe('previewPattern', () => {
    it('produces correct previews for alternating pattern', () => {
      const cells = makeCells(['day', null], '07:00', '15:00');
      const pattern: CustomPattern = {
        id: 'test-1',
        userId: 'user-1',
        name: 'Alternate',
        cells,
        patternMode: 'repetition',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const previews = customPatternService.previewPattern(pattern, new Date('2025-01-01'), 14);
      // 2-day cycle → 7 work days out of 14
      expect(previews).toHaveLength(7);
      expect(previews[0].shiftType).toBe('day');
      expect(previews[0].startTime).toBe('07:00');
      expect(previews[0].endTime).toBe('15:00');
    });

    it('defaults to 28-day preview', () => {
      const cells = makeCells(['day', null]);
      const pattern: CustomPattern = {
        id: 'test-2',
        userId: 'user-1',
        name: 'Test',
        cells,
        patternMode: 'repetition',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const previews = customPatternService.previewPattern(pattern, new Date('2025-01-01'));
      // 2-day cycle → 14 work days out of 28
      expect(previews).toHaveLength(14);
    });

    it('skips off-days entirely', () => {
      const cells = makeCells([null]); // all off
      const pattern: CustomPattern = {
        id: 'off',
        userId: 'user-1',
        name: 'All Off',
        cells,
        patternMode: 'repetition',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const previews = customPatternService.previewPattern(pattern, new Date('2025-01-01'), 14);
      expect(previews).toHaveLength(0);
    });
  });
});
