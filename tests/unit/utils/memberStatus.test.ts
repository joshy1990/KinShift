/**
 * Unit tests for member status determination
 */
import { getMemberStatus, getStatusColor, getStatusLabel, MemberStatus } from '@/utils/memberStatus';
import { Shift } from '@/types';

// Helper to create a shift at a specific time range
function makeShift(overrides: Partial<Shift> & { startTime: Date; endTime: Date }): Shift {
  return {
    id: 'shift-1',
    ownerId: 'user-1',
    title: 'Test Shift',
    colorTag: '#FF6B6B',
    shiftType: 'day',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastEditedBy: 'user-1',
    ...overrides,
  };
}

describe('memberStatus', () => {
  describe('getMemberStatus', () => {
    it('returns available when user has no shifts', () => {
      const result = getMemberStatus('user-1', []);
      expect(result.status).toBe('available');
      expect(result.color).toBe('#10B981');
      expect(result.label).toBe('Available');
    });

    it('returns available when shifts belong to a different user', () => {
      const now = new Date();
      const shifts: Shift[] = [
        makeShift({
          ownerId: 'user-2',
          startTime: new Date(now.getTime() - 3600000),
          endTime: new Date(now.getTime() + 3600000),
        }),
      ];
      const result = getMemberStatus('user-1', shifts);
      expect(result.status).toBe('available');
    });

    it('returns working when user has an active shift right now', () => {
      const now = new Date();
      const shifts: Shift[] = [
        makeShift({
          ownerId: 'user-1',
          startTime: new Date(now.getTime() - 3600000), // started 1 hour ago
          endTime: new Date(now.getTime() + 3600000),   // ends in 1 hour
        }),
      ];
      const result = getMemberStatus('user-1', shifts);
      expect(result.status).toBe('working');
      expect(result.color).toBe('#EF4444');
      expect(result.currentShift).toBeTruthy();
    });

    it('returns busy when user has a shift starting within 2 hours', () => {
      const now = new Date();
      const shifts: Shift[] = [
        makeShift({
          ownerId: 'user-1',
          startTime: new Date(now.getTime() + 60 * 60 * 1000), // starts in 1 hour
          endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        }),
      ];
      const result = getMemberStatus('user-1', shifts);
      expect(result.status).toBe('busy');
      expect(result.color).toBe('#F59E0B');
    });

    it('returns available when shift starts more than 2 hours in the future', () => {
      const now = new Date();
      const shifts: Shift[] = [
        makeShift({
          ownerId: 'user-1',
          startTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // starts in 3 hours
          endTime: new Date(now.getTime() + 11 * 60 * 60 * 1000),
        }),
      ];
      const result = getMemberStatus('user-1', shifts);
      expect(result.status).toBe('available');
    });

    it('ignores soft-deleted shifts', () => {
      const now = new Date();
      const shifts: Shift[] = [
        makeShift({
          ownerId: 'user-1',
          isDeleted: true,
          startTime: new Date(now.getTime() - 3600000),
          endTime: new Date(now.getTime() + 3600000),
        }),
      ];
      const result = getMemberStatus('user-1', shifts);
      expect(result.status).toBe('available');
    });

    it('prioritises working over busy when both exist', () => {
      const now = new Date();
      const shifts: Shift[] = [
        makeShift({
          id: 'active',
          ownerId: 'user-1',
          title: 'Active Shift',
          startTime: new Date(now.getTime() - 3600000),
          endTime: new Date(now.getTime() + 3600000),
        }),
        makeShift({
          id: 'upcoming',
          ownerId: 'user-1',
          title: 'Next Shift',
          startTime: new Date(now.getTime() + 30 * 60 * 1000),
          endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        }),
      ];
      const result = getMemberStatus('user-1', shifts);
      expect(result.status).toBe('working');
    });
  });

  describe('getStatusColor', () => {
    it('returns correct colors for each status', () => {
      expect(getStatusColor('available')).toBe('#10B981');
      expect(getStatusColor('working')).toBe('#EF4444');
      expect(getStatusColor('busy')).toBe('#F59E0B');
    });

    it('returns grey for unknown status', () => {
      expect(getStatusColor('unknown' as MemberStatus)).toBe('#6B7280');
    });
  });

  describe('getStatusLabel', () => {
    it('returns correct labels', () => {
      expect(getStatusLabel('available')).toBe('Available');
      expect(getStatusLabel('working')).toBe('Working');
      expect(getStatusLabel('busy')).toBe('Busy');
    });
  });
});
