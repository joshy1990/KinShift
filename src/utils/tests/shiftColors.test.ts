import {analyzeMultiPersonShifts, SHIFT_TYPE_COLORS} from '../shiftColors';
import {Shift, ShiftType} from '@/types';

describe('Multi-Person Shift Visualization', () => {
  const currentUserId = 'user1';  // Make user1 the current user

  const createShift = (
    id: string,
    ownerId: string,
    shiftType: ShiftType = 'day',
    startTime: Date = new Date('2024-01-15T08:00:00')
  ): Shift => ({
    id,
    title: `${shiftType} Shift`,
    householdId: 'household1',
    ownerId,
    startTime,
    endTime: new Date(startTime.getTime() + 8 * 60 * 60 * 1000),
    colorTag: SHIFT_TYPE_COLORS[shiftType],
    shiftType,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastEditedBy: ownerId,
  });

  describe('analyzeMultiPersonShifts', () => {
    it('should detect single person working', () => {
      const shifts = [
        createShift('shift1', 'user1', 'day'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.userCount).toBe(1);
      expect(result.displayStrategy).toBe('single');
      expect(result.colors).toHaveLength(1);
      expect(result.workingCount).toBe(1);
    });

    it('should detect two people working and suggest split display', () => {
      const shifts = [
        createShift('shift1', 'user1', 'day'),
        createShift('shift2', 'user2', 'night'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.userCount).toBe(2);
      expect(result.displayStrategy).toBe('split');
      expect(result.colors).toHaveLength(2);
    });

    it('should detect three or more people and suggest multi display', () => {
      const shifts = [
        createShift('shift1', 'user1', 'day'),
        createShift('shift2', 'user2', 'night'),
        createShift('shift3', 'user3', 'twilight'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.userCount).toBe(3);
      expect(result.displayStrategy).toBe('multi');
    });

    it('should handle multiple shifts from same user correctly', () => {
      const shifts = [
        createShift('shift1', 'user1', 'day', new Date('2024-01-15T08:00:00')),
        createShift('shift2', 'user1', 'night', new Date('2024-01-15T20:00:00')),
        createShift('shift3', 'user2', 'day'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      // Should count unique users, not shifts
      expect(result.userCount).toBe(2);
      expect(result.displayStrategy).toBe('split');
    });

    it('should assign correct colors based on ownership', () => {
      const shifts = [
        createShift('shift1', currentUserId, 'day'),
        createShift('shift2', 'other-user', 'night'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.colors).toHaveLength(2);
      expect(result.workingCount).toBe(2);
    });

    it('should handle empty shift array', () => {
      const shifts: Shift[] = [];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.userCount).toBe(0);
      expect(result.displayStrategy).toBe('single');
      expect(result.colors).toHaveLength(0);
    });

    it('should handle four people working', () => {
      const shifts = [
        createShift('shift1', 'user1', 'day'),
        createShift('shift2', 'user2', 'night'),
        createShift('shift3', 'user3', 'twilight'),
        createShift('shift4', 'user4', 'custom'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.userCount).toBe(4);
      expect(result.displayStrategy).toBe('multi');
    });

    it('should handle same shift type for multiple users', () => {
      const shifts = [
        createShift('shift1', 'user1', 'day'),
        createShift('shift2', 'user2', 'day'),
      ];

      const result = analyzeMultiPersonShifts(shifts, currentUserId);

      expect(result.userCount).toBe(2);
      expect(result.displayStrategy).toBe('split');
      expect(result.colors).toHaveLength(2);
    });
  });
});
