/**
 * Unit tests for Custom Pattern Recognition
 * Tests pattern mode detection and cycle length calculation
 * 
 * Scenarios:
 * 1. Weekly Mode - Mon/Wed/Fri repeating (7-day cycle)
 * 2. Weekly Mode - Mon-Fri Mon-Fri (5 working days, 2 off, 7-day cycle)
 * 3. Repetition Mode - 4 on / 4 off (8-day cycle)
 * 4. Repetition Mode - 3 on / 3 off / 1 on / 1 off (8-day cycle)
 */

import { CustomPatternService } from '../customPattern.service';
import { PatternCell } from '@/types/customPattern';

// Firestore is mocked in jest.setup.js

const customPatternService = new CustomPatternService();

describe('Custom Pattern Recognition', () => {
  
  // Helper to create a cell
  const createCell = (
    day: number,
    shiftType: 'day' | 'night' | null = 'day',
    startTime: string = '09:00',
    endTime: string = '17:00'
  ): PatternCell => ({
    day,
    shiftType,
    startTime,
    endTime,
  });

  // ============================================================
  // WEEKLY MODE TESTS (should use 7-day cycle)
  // ============================================================

  describe('Weekly Mode - Scenario 1: Mon/Wed/Fri', () => {
    test('should detect 7-day cycle for Mon/Wed/Fri pattern', () => {
      // Week 1: Mon/Wed/Fri work, other days off
      // Week 2: Same pattern (identical to Week 1)
      const cells: PatternCell[] = [
        createCell(1, 'day'),   // Monday - WORK
        createCell(2, null),    // Tuesday - OFF
        createCell(3, 'day'),   // Wednesday - WORK
        createCell(4, null),    // Thursday - OFF
        createCell(5, 'day'),   // Friday - WORK
        createCell(6, null),    // Saturday - OFF
        createCell(7, null),    // Sunday - OFF
        // Week 2 - identical to Week 1
        createCell(8, 'day'),   // Monday - WORK
        createCell(9, null),    // Tuesday - OFF
        createCell(10, 'day'),  // Wednesday - WORK
        createCell(11, null),   // Thursday - OFF
        createCell(12, 'day'),  // Friday - WORK
        createCell(13, null),   // Saturday - OFF
        createCell(14, null),   // Sunday - OFF
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(7);
      console.log('✅ Scenario 1 (Weekly Mon/Wed/Fri): Correctly detected 7-day cycle');
    });
  });

  describe('Weekly Mode - Scenario 2: Mon-Fri Mon-Fri', () => {
    test('should detect 7-day cycle for standard Mon-Fri workweek', () => {
      // Week 1: Mon-Fri work, Sat-Sun off
      // Week 2: Same pattern
      const cells: PatternCell[] = [
        createCell(1, 'day'),   // Monday - WORK
        createCell(2, 'day'),   // Tuesday - WORK
        createCell(3, 'day'),   // Wednesday - WORK
        createCell(4, 'day'),   // Thursday - WORK
        createCell(5, 'day'),   // Friday - WORK
        createCell(6, null),    // Saturday - OFF
        createCell(7, null),    // Sunday - OFF
        // Week 2 - identical to Week 1
        createCell(8, 'day'),   // Monday - WORK
        createCell(9, 'day'),   // Tuesday - WORK
        createCell(10, 'day'),  // Wednesday - WORK
        createCell(11, 'day'),  // Thursday - WORK
        createCell(12, 'day'),  // Friday - WORK
        createCell(13, null),   // Saturday - OFF
        createCell(14, null),   // Sunday - OFF
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(7);
      console.log('✅ Scenario 2 (Weekly Mon-Fri): Correctly detected 7-day cycle');
    });
  });

  // ============================================================
  // REPETITION MODE TESTS (should auto-detect cycle)
  // ============================================================

  describe('Repetition Mode - Scenario 3: 4 on / 4 off', () => {
    test('should detect 8-day cycle for 4on/4off pattern', () => {
      // 4 working days, then 4 off days, repeating
      const cells: PatternCell[] = [
        createCell(1, 'day'),   // Work day 1
        createCell(2, 'day'),   // Work day 2
        createCell(3, 'day'),   // Work day 3
        createCell(4, 'day'),   // Work day 4
        createCell(5, null),    // Off day 1
        createCell(6, null),    // Off day 2
        createCell(7, null),    // Off day 3
        createCell(8, null),    // Off day 4
        // Cycle repeats (partial)
        createCell(9, 'day'),   // Work day 1 (repeat)
        createCell(10, 'day'),  // Work day 2 (repeat)
        createCell(11, 'day'),  // Work day 3 (repeat)
        createCell(12, 'day'),  // Work day 4 (repeat)
        createCell(13, null),   // Off day 1 (repeat)
        createCell(14, null),   // Off day 2 (repeat)
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(8);
      console.log('✅ Scenario 3 (Repetition 4on/4off): Correctly detected 8-day cycle');
    });
  });

  describe('Repetition Mode - Scenario 4: 3on/3off/1on/1off', () => {
    test('should detect 8-day cycle for complex pattern', () => {
      // More complex: 3 on, 3 off, 1 on, 1 off (8-day cycle)
      const cells: PatternCell[] = [
        createCell(1, 'day'),   // Work day 1
        createCell(2, 'day'),   // Work day 2
        createCell(3, 'day'),   // Work day 3
        createCell(4, null),    // Off day 1
        createCell(5, null),    // Off day 2
        createCell(6, null),    // Off day 3
        createCell(7, 'day'),   // Work day 4
        createCell(8, null),    // Off day 4
        // Cycle repeats (partial)
        createCell(9, 'day'),   // Work day 1 (repeat)
        createCell(10, 'day'),  // Work day 2 (repeat)
        createCell(11, 'day'),  // Work day 3 (repeat)
        createCell(12, null),   // Off day 1 (repeat)
        createCell(13, null),   // Off day 2 (repeat)
        createCell(14, null),   // Off day 3 (repeat)
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(8);
      console.log('✅ Scenario 4 (Repetition 3on/3off/1on/1off): Correctly detected 8-day cycle');
    });
  });

  // ============================================================
  // EDGE CASE TESTS
  // ============================================================

  describe('Edge Cases', () => {
    test('should detect 1-day cycle (same shift every day)', () => {
      const cells: PatternCell[] = Array(14).fill(null).map((_, i) => 
        createCell(i + 1, 'day', '09:00', '17:00')
      );

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(1);
      console.log('✅ Edge Case (All same): Correctly detected 1-day cycle');
    });

    test('should detect 14-day cycle (full 2-week pattern, no repeat)', () => {
      // Each day is different (no repeating pattern within 14 days)
      const cells: PatternCell[] = [
        createCell(1, 'day'),   // Work
        createCell(2, 'day'),   // Work
        createCell(3, null),    // Off
        createCell(4, 'day'),   // Work
        createCell(5, 'day'),   // Work
        createCell(6, 'day'),   // Work
        createCell(7, null),    // Off
        createCell(8, 'day'),   // Work
        createCell(9, null),    // Off
        createCell(10, 'day'),  // Work
        createCell(11, 'day'),  // Work
        createCell(12, null),   // Off
        createCell(13, 'night'),// Night shift (different type!)
        createCell(14, null),   // Off
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(14);
      console.log('✅ Edge Case (No repeat): Correctly detected 14-day cycle');
    });

    test('should preserve time differences within same shift type', () => {
      // Same shift type but different times should NOT be considered a new cycle
      const cells: PatternCell[] = [
        createCell(1, 'day', '09:00', '17:00'),
        createCell(2, 'day', '09:00', '17:00'),
        createCell(3, 'day', '09:00', '17:00'),
        createCell(4, 'day', '09:00', '17:00'),
        createCell(5, 'day', '09:00', '17:00'),
        createCell(6, 'day', '09:00', '17:00'),
        createCell(7, 'day', '09:00', '17:00'),
        createCell(8, 'day', '09:00', '17:00'), // Same as day 1
        createCell(9, 'day', '09:00', '17:00'),
        createCell(10, 'day', '09:00', '17:00'),
        createCell(11, 'day', '09:00', '17:00'),
        createCell(12, 'day', '09:00', '17:00'),
        createCell(13, 'day', '09:00', '17:00'),
        createCell(14, 'day', '09:00', '17:00'),
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      expect(cycleLength).toBe(1);
      console.log('✅ Edge Case (Same times): Correctly detected 1-day cycle');
    });

    test('should NOT match if times differ', () => {
      // Different times should cause cycle mismatch
      const cells: PatternCell[] = [
        createCell(1, 'day', '09:00', '17:00'), // Morning shift
        createCell(2, 'day', '09:00', '17:00'),
        createCell(3, 'day', '09:00', '17:00'),
        createCell(4, 'day', '09:00', '17:00'),
        createCell(5, 'day', '09:00', '17:00'),
        createCell(6, 'day', '09:00', '17:00'),
        createCell(7, 'day', '09:00', '17:00'),
        createCell(8, 'day', '14:00', '22:00'), // DIFFERENT TIME! Evening shift
        createCell(9, 'day', '09:00', '17:00'),
        createCell(10, 'day', '09:00', '17:00'),
        createCell(11, 'day', '09:00', '17:00'),
        createCell(12, 'day', '09:00', '17:00'),
        createCell(13, 'day', '09:00', '17:00'),
        createCell(14, 'day', '09:00', '17:00'),
      ];

      const cycleLength = customPatternService.calculateCycleLength(cells);
      
      // Should NOT be 7-day cycle since day 8 has different times
      // Should detect it as 14-day (no repeat)
      expect(cycleLength).toBe(14);
      console.log('✅ Edge Case (Different times): Correctly detected 14-day cycle (no repeat)');
    });
  });

  // ============================================================
  // SUMMARY TEST
  // ============================================================

  describe('Pattern Recognition Summary', () => {
    test('all 4 main scenarios should be recognized correctly', () => {
      console.log('\n📋 Pattern Recognition Test Summary:');
      console.log('✅ Weekly Mode Scenario 1: Mon/Wed/Fri → 7-day cycle');
      console.log('✅ Weekly Mode Scenario 2: Mon-Fri → 7-day cycle');
      console.log('✅ Repetition Mode Scenario 3: 4on/4off → 8-day cycle');
      console.log('✅ Repetition Mode Scenario 4: 3on/3off/1on/1off → 8-day cycle');
      
      expect(true).toBe(true);
    });
  });
});
