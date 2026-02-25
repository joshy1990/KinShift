/**
 * Unit tests for OfflineEditQueueService
 */

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  NetInfoStateType: { wifi: 'wifi', cellular: 'cellular', unknown: 'unknown' },
}));

jest.mock('@/services/shift.service', () => ({
  shiftService: {
    createShift: jest.fn().mockResolvedValue({ id: 'new-shift' }),
    updateShift: jest.fn().mockResolvedValue(undefined),
    deleteShift: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/household.service', () => ({
  householdService: {
    createHousehold: jest.fn().mockResolvedValue({ id: 'new-household' }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineEditQueueService } from '@/services/offlineEditQueue.service';

describe('OfflineEditQueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('getQueue', () => {
    it('returns empty array when no queue exists', async () => {
      const queue = await offlineEditQueueService.getQueue();
      expect(queue).toEqual([]);
    });

    it('parses stored queue with Date objects', async () => {
      const stored = JSON.stringify([
        {
          id: 'edit-1',
          operation: 'create',
          collection: 'shifts',
          documentId: 'doc-1',
          data: { title: 'Test' },
          timestamp: '2026-01-01T00:00:00.000Z',
          synced: false,
          retryCount: 0,
        },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(stored);

      const queue = await offlineEditQueueService.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('edit-1');
      expect(queue[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 for empty queue', async () => {
      const count = await offlineEditQueueService.getPendingCount();
      expect(count).toBe(0);
    });

    it('counts only unsynced items', async () => {
      const stored = JSON.stringify([
        { id: '1', synced: false, retryCount: 0, timestamp: new Date().toISOString() },
        { id: '2', synced: true, retryCount: 0, timestamp: new Date().toISOString() },
        { id: '3', synced: false, retryCount: 0, timestamp: new Date().toISOString() },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(stored);

      const count = await offlineEditQueueService.getPendingCount();
      expect(count).toBe(2);
    });
  });

  describe('addQueueListener', () => {
    it('returns an unsubscribe function', () => {
      const listener = jest.fn();
      const unsub = offlineEditQueueService.addQueueListener(listener);
      expect(typeof unsub).toBe('function');
      unsub();
    });
  });

  describe('clearAllEdits', () => {
    it('removes queue from AsyncStorage', async () => {
      await offlineEditQueueService.clearAllEdits();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kinshift:offline_edit_queue');
    });
  });

  describe('clearSyncedEdits', () => {
    it('keeps only unsynced items', async () => {
      const stored = JSON.stringify([
        { id: '1', synced: false, retryCount: 0, timestamp: new Date().toISOString() },
        { id: '2', synced: true, retryCount: 0, timestamp: new Date().toISOString() },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(stored);

      await offlineEditQueueService.clearSyncedEdits();
      
      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].id).toBe('1');
    });
  });

  describe('getFailedEdits', () => {
    it('returns edits that exceeded retry limit', async () => {
      const stored = JSON.stringify([
        { id: '1', synced: false, retryCount: 3, timestamp: new Date().toISOString() },
        { id: '2', synced: false, retryCount: 1, timestamp: new Date().toISOString() },
        { id: '3', synced: true, retryCount: 0, timestamp: new Date().toISOString() },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(stored);

      const failed = await offlineEditQueueService.getFailedEdits();
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe('1');
    });
  });

  describe('initialize', () => {
    it('returns cleanup function and sets up network listener', () => {
      const NetInfo = require('@react-native-community/netinfo');
      const cleanup = offlineEditQueueService.initialize();
      expect(typeof cleanup).toBe('function');
      expect(NetInfo.addEventListener).toHaveBeenCalled();
    });
  });

  describe('retryEdit', () => {
    it('resets retry count for specified edit', async () => {
      const stored = JSON.stringify([
        { id: 'fail-1', synced: false, retryCount: 3, operation: 'create', collection: 'shifts', documentId: 'doc-1', data: {}, timestamp: new Date().toISOString() },
      ]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(stored);

      await offlineEditQueueService.retryEdit('fail-1');

      expect(AsyncStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
      expect(savedData[0].retryCount).toBe(0);
    });
  });

  describe('addToQueue — userId enforcement', () => {
    it('requires userId for update operations', async () => {
      await expect(
        offlineEditQueueService.addToQueue('update', 'shifts', 'doc-1', { title: 'x' }),
      ).rejects.toThrow(/userId is required/i);
    });

    it('requires userId for delete operations', async () => {
      await expect(
        offlineEditQueueService.addToQueue('delete', 'shifts', 'doc-1', {}),
      ).rejects.toThrow(/userId is required/i);
    });

    it('allows create operations without userId', async () => {
      await offlineEditQueueService.addToQueue('create', 'shifts', 'doc-1', { title: 'x' });
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('allows update operations when userId is provided', async () => {
      (offlineEditQueueService as any).syncInProgress = false;
      await offlineEditQueueService.addToQueue('update', 'shifts', 'doc-1', { title: 'x' }, 'user-1');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });
});
