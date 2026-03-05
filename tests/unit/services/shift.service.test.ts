/**
 * Unit tests for ShiftService — ownership enforcement
 *
 * Verifies:
 *  1. updateShift rejects non-owners (personal shift)
 *  2. updateShift rejects non-owners (household shift, even with allowMemberEditOthers=true)
 *  3. updateShift allows the owner
 *  4. deleteShift rejects non-owners
 *  5. deleteShift allows the owner
 *  6. deleteBulkShifts requires userId
 *  7. deleteBulkShifts rejects if any shift belongs to another user
 *  8. deleteBulkShifts succeeds when all shifts belong to user
 *  9. createShift rejects mismatched ownerId
 */

// ── Mock Firebase modules ──────────────────────────

const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();

jest.mock('@/config/firestore.compat', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  collection: (...args: any[]) => mockCollection(...args),
  writeBatch: () => mockWriteBatch(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  onSnapshot: jest.fn(),
  deleteDoc: jest.fn(),
}));

jest.mock('@/config/firebase.config', () => ({
  db: {},
}));

jest.mock('@/services/household.service', () => ({
  householdService: {
    getHousehold: jest.fn(),
    validateHouseholdCompliance: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('@/services/notification.service', () => ({
  notificationService: {
    notifyShiftCreated: jest.fn(),
    notifyShiftUpdated: jest.fn(),
    notifyShiftDeleted: jest.fn(),
    scheduleShiftReminder: jest.fn(),
    sendPushToUser: jest.fn(),
  },
}));

jest.mock('@/services/auth.service', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    getUserData: jest.fn().mockResolvedValue({ name: 'Test User' }),
  },
}));

jest.mock('@/utils/shiftTypeHelpers', () => ({
  getShiftTypeColor: jest.fn().mockReturnValue('#000'),
  getShiftTypeLabel: jest.fn().mockReturnValue('Day'),
}));

import { shiftService } from '@/services/shift.service';
import { householdService } from '@/services/household.service';
import { authService } from '@/services/auth.service';

// ── Helpers ─────────────────────────────────────────

function mockShiftDoc(data: any, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
    id: data?.id || 'shift-1',
  };
}

// ── Tests ───────────────────────────────────────────

describe('ShiftService — ownership enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue('shift-ref');
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  // ─── updateShift ──────────────────────────────────

  describe('updateShift', () => {
    it('rejects when non-owner tries to update a personal shift', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'owner-user',
          title: 'My Shift',
          // No householdId → personal shift
        }),
      );

      await expect(
        shiftService.updateShift('shift-1', { title: 'Hacked' }, 'attacker-user'),
      ).rejects.toThrow(/Unauthorized/);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects when non-owner tries to update a household shift (even if allowMemberEditOthers is true)', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'owner-user',
          householdId: 'household-1',
        }),
      );

      (householdService.getHousehold as jest.Mock).mockResolvedValue({
        id: 'household-1',
        members: ['owner-user', 'other-member'],
        admins: ['owner-user'],
        settings: { allowMemberEditOthers: true }, // Even with this on, should still reject
      });

      await expect(
        shiftService.updateShift('shift-1', { title: 'Hacked' }, 'other-member'),
      ).rejects.toThrow(/Unauthorized.*own/i);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('allows the owner to update their own shift', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'owner-user',
          householdId: 'household-1',
        }),
      );

      (householdService.getHousehold as jest.Mock).mockResolvedValue({
        id: 'household-1',
        members: ['owner-user', 'other-member'],
        admins: ['owner-user'],
        settings: { allowMemberEditOthers: false },
      });

      await shiftService.updateShift('shift-1', { title: 'Updated Title' }, 'owner-user');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('rejects when admin tries to update another member\'s shift', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'regular-member',
          householdId: 'household-1',
        }),
      );

      (householdService.getHousehold as jest.Mock).mockResolvedValue({
        id: 'household-1',
        members: ['admin-user', 'regular-member'],
        admins: ['admin-user'],
        settings: { allowMemberEditOthers: true },
      });

      await expect(
        shiftService.updateShift('shift-1', { title: 'Admin Override' }, 'admin-user'),
      ).rejects.toThrow(/Unauthorized.*own/i);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // ─── deleteShift ──────────────────────────────────

  describe('deleteShift', () => {
    it('rejects when non-owner tries to delete a personal shift', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'owner-user',
        }),
      );

      await expect(
        shiftService.deleteShift('shift-1', 'attacker-user'),
      ).rejects.toThrow(/Unauthorized/);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('rejects when admin tries to delete another member\'s household shift', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'regular-member',
          householdId: 'household-1',
        }),
      );

      (householdService.getHousehold as jest.Mock).mockResolvedValue({
        id: 'household-1',
        members: ['admin-user', 'regular-member'],
        admins: ['admin-user'],
        settings: {},
      });

      await expect(
        shiftService.deleteShift('shift-1', 'admin-user'),
      ).rejects.toThrow(/Unauthorized/);

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });

    it('allows the owner to delete their own shift', async () => {
      mockGetDoc.mockResolvedValue(
        mockShiftDoc({
          id: 'shift-1',
          ownerId: 'owner-user',
          householdId: 'household-1',
        }),
      );

      (householdService.getHousehold as jest.Mock).mockResolvedValue({
        id: 'household-1',
        members: ['owner-user'],
        admins: ['owner-user'],
        settings: {},
      });

      await shiftService.deleteShift('shift-1', 'owner-user');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        'shift-ref',
        expect.objectContaining({ isDeleted: true, lastEditedBy: 'owner-user' }),
      );
    });
  });

  // ─── deleteBulkShifts ─────────────────────────────

  describe('deleteBulkShifts', () => {
    it('throws when userId is not provided', async () => {
      await expect(
        shiftService.deleteBulkShifts(['shift-1'], '' as any),
      ).rejects.toThrow(/userId is required/i);
    });

    it('rejects when any shift belongs to another user', async () => {
      mockGetDoc
        .mockResolvedValueOnce(mockShiftDoc({ ownerId: 'owner-user' }))
        .mockResolvedValueOnce(mockShiftDoc({ ownerId: 'someone-else' }));

      await expect(
        shiftService.deleteBulkShifts(['shift-1', 'shift-2'], 'owner-user'),
      ).rejects.toThrow(/Unauthorized.*own/i);
    });

    it('succeeds when all shifts belong to the user', async () => {
      const mockBatch = {
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      mockGetDoc
        .mockResolvedValueOnce(mockShiftDoc({ ownerId: 'owner-user' }))
        .mockResolvedValueOnce(mockShiftDoc({ ownerId: 'owner-user' }));

      await shiftService.deleteBulkShifts(['shift-1', 'shift-2'], 'owner-user');

      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('handles empty array without errors', async () => {
      await shiftService.deleteBulkShifts([], 'owner-user');
      expect(mockGetDoc).not.toHaveBeenCalled();
    });
  });

  // ─── createShift ──────────────────────────────────

  describe('createShift', () => {
    it('rejects when ownerId does not match authenticated user', async () => {
      (authService.getCurrentUser as jest.Mock).mockResolvedValue({
        id: 'real-user',
        name: 'Real User',
        email: 'real@example.com',
      });

      await expect(
        shiftService.createShift({
          ownerId: 'impersonated-user',
          title: 'Fake Shift',
          startTime: new Date('2026-03-01T09:00:00'),
          endTime: new Date('2026-03-01T17:00:00'),
          shiftType: 'day',
        }),
      ).rejects.toThrow(/Unauthorized.*another user/i);
    });
  });
});
