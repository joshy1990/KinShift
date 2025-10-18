import {
  getShiftsForUserAndDate,
  analyzeCoverage,
  getUserInitials,
  generateDateRange,
  countCoverageGaps,
  countCoverageOverlaps,
} from '../twoWeekView.helpers';
import {Shift, ShiftType} from '@/types';

describe('Two Week View Helpers', () => {
  const createShift = (
    id: string,
    ownerId: string,
    startTime: Date,
    shiftType: ShiftType = 'days'
  ): Shift => ({
    id,
    title: `${shiftType} Shift`,
    householdId: 'household1',
    ownerId,
    startTime,
    endTime: new Date(startTime.getTime() + 8 * 60 * 60 * 1000),
    colorTag: '#2ECC71',
    shiftType,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastEditedBy: ownerId,
  });

  describe('getShiftsForUserAndDate', () => {
    it('should return shifts for specific user and date', () => {
      const date = new Date('2024-01-15');
      const shifts = [
        createShift('1', 'user1', date),
        createShift('2', 'user2', date),
        createShift('3', 'user1', new Date('2024-01-16')),
      ];

      const result = getShiftsForUserAndDate(shifts, 'user1', date);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('should return empty array if no shifts found', () => {
      const date = new Date('2024-01-15');
      const shifts = [
        createShift('1', 'user1', new Date('2024-01-16')),
      ];

      const result = getShiftsForUserAndDate(shifts, 'user1', date);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple shifts for same user on same day', () => {
      const date = new Date('2024-01-15T08:00:00');
      const shifts = [
        createShift('1', 'user1', date, 'days'),
        createShift('2', 'user1', new Date('2024-01-15T20:00:00'), 'nights'),
      ];

      const result = getShiftsForUserAndDate(shifts, 'user1', date);

      expect(result).toHaveLength(2);
    });
  });

  describe('analyzeCoverage', () => {
    it('should detect gap (no one working)', () => {
      const date = new Date('2024-01-15');
      const shifts = [
        createShift('1', 'user1', new Date('2024-01-16')),
      ];

      const result = analyzeCoverage(shifts, date);

      expect(result.working).toBe(0);
      expect(result.gap).toBe(true);
      expect(result.overlap).toBe(false);
    });

    it('should detect single person working', () => {
      const date = new Date('2024-01-15');
      const shifts = [
        createShift('1', 'user1', date),
      ];

      const result = analyzeCoverage(shifts, date);

      expect(result.working).toBe(1);
      expect(result.gap).toBe(false);
      expect(result.overlap).toBe(false);
    });

    it('should detect overlap (multiple people working)', () => {
      const date = new Date('2024-01-15');
      const shifts = [
        createShift('1', 'user1', date),
        createShift('2', 'user2', date),
      ];

      const result = analyzeCoverage(shifts, date);

      expect(result.working).toBe(2);
      expect(result.gap).toBe(false);
      expect(result.overlap).toBe(true);
    });

    it('should count unique users correctly', () => {
      const date = new Date('2024-01-15T08:00:00');
      const shifts = [
        createShift('1', 'user1', date, 'days'),
        createShift('2', 'user1', new Date('2024-01-15T20:00:00'), 'nights'),
        createShift('3', 'user2', date),
      ];

      const result = analyzeCoverage(shifts, date);

      expect(result.working).toBe(2); // Only 2 unique users
      expect(result.overlap).toBe(true);
    });

    it('should detect three people working', () => {
      const date = new Date('2024-01-15');
      const shifts = [
        createShift('1', 'user1', date),
        createShift('2', 'user2', date),
        createShift('3', 'user3', date),
      ];

      const result = analyzeCoverage(shifts, date);

      expect(result.working).toBe(3);
      expect(result.overlap).toBe(true);
    });
  });

  describe('getUserInitials', () => {
    it('should extract initials from first and last name', () => {
      expect(getUserInitials('John Doe')).toBe('JD');
      expect(getUserInitials('Jane Smith')).toBe('JS');
    });

    it('should handle single name', () => {
      expect(getUserInitials('John')).toBe('J');
    });

    it('should handle three or more names', () => {
      expect(getUserInitials('John Michael Doe')).toBe('JD');
    });

    it('should uppercase initials', () => {
      expect(getUserInitials('john doe')).toBe('JD');
    });
  });

  describe('generateDateRange', () => {
    it('should generate 14-day range', () => {
      const startDate = new Date('2024-01-15');
      const result = generateDateRange(startDate, 14);

      expect(result).toHaveLength(14);
      expect(result[0]).toEqual(startDate);
      expect(result[13]).toEqual(new Date('2024-01-28'));
    });

    it('should generate 7-day range', () => {
      const startDate = new Date('2024-01-15');
      const result = generateDateRange(startDate, 7);

      expect(result).toHaveLength(7);
    });

    it('should handle single day', () => {
      const startDate = new Date('2024-01-15');
      const result = generateDateRange(startDate, 1);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(startDate);
    });
  });

  describe('countCoverageGaps', () => {
    it('should count days with no coverage', () => {
      const dateRange = generateDateRange(new Date('2024-01-15'), 7);
      const shifts = [
        createShift('1', 'user1', new Date('2024-01-15')),
        createShift('2', 'user1', new Date('2024-01-16')),
        // Days 17, 18, 19, 20, 21 have no coverage
      ];

      const result = countCoverageGaps(shifts, dateRange);

      expect(result).toBe(5); // 5 days with gaps
    });

    it('should return 0 if all days covered', () => {
      const dateRange = generateDateRange(new Date('2024-01-15'), 3);
      const shifts = [
        createShift('1', 'user1', new Date('2024-01-15')),
        createShift('2', 'user2', new Date('2024-01-16')),
        createShift('3', 'user3', new Date('2024-01-17')),
      ];

      const result = countCoverageGaps(shifts, dateRange);

      expect(result).toBe(0);
    });

    it('should handle all gaps', () => {
      const dateRange = generateDateRange(new Date('2024-01-15'), 5);
      const shifts: Shift[] = [];

      const result = countCoverageGaps(shifts, dateRange);

      expect(result).toBe(5);
    });
  });

  describe('countCoverageOverlaps', () => {
    it('should count days with multiple people', () => {
      const dateRange = generateDateRange(new Date('2024-01-15'), 5);
      const shifts = [
        createShift('1', 'user1', new Date('2024-01-15')),
        createShift('2', 'user2', new Date('2024-01-15')),
        createShift('3', 'user1', new Date('2024-01-16')),
        createShift('4', 'user2', new Date('2024-01-17')),
        createShift('5', 'user3', new Date('2024-01-17')),
      ];

      const result = countCoverageOverlaps(shifts, dateRange);

      expect(result).toBe(2); // Jan 15 and Jan 17 have overlaps
    });

    it('should return 0 if no overlaps', () => {
      const dateRange = generateDateRange(new Date('2024-01-15'), 3);
      const shifts = [
        createShift('1', 'user1', new Date('2024-01-15')),
        createShift('2', 'user2', new Date('2024-01-16')),
        createShift('3', 'user3', new Date('2024-01-17')),
      ];

      const result = countCoverageOverlaps(shifts, dateRange);

      expect(result).toBe(0);
    });

    it('should count day with 3+ people as overlap', () => {
      const date = new Date('2024-01-15');
      const dateRange = [date];
      const shifts = [
        createShift('1', 'user1', date),
        createShift('2', 'user2', date),
        createShift('3', 'user3', date),
      ];

      const result = countCoverageOverlaps(shifts, dateRange);

      expect(result).toBe(1);
    });
  });
});
