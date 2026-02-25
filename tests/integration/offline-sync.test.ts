/**
 * Integration tests — Offline sync flow
 *
 * Tests the offline queue lifecycle: enqueue → persist → sync → cleanup.
 */

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: false }),
  NetInfoStateType: { wifi: 'wifi', cellular: 'cellular', unknown: 'unknown' },
}));

jest.mock('@/services/shift.service', () => ({
  shiftService: {
    createShift: jest.fn().mockResolvedValue({ id: 'shift-1' }),
    updateShift: jest.fn().mockResolvedValue(undefined),
    deleteShift: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/household.service', () => ({
  householdService: {
    createHousehold: jest.fn().mockResolvedValue({ id: 'h-1' }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { offlineEditQueueService } from '@/services/offlineEditQueue.service';
import { shiftService } from '@/services/shift.service';

describe('Offline Sync Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    // Default: offline
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
    // Reset singleton's internal state
    (offlineEditQueueService as any).syncInProgress = false;
  });

  it('enqueues edits when offline', async () => {
    await offlineEditQueueService.addToQueue(
      'create',
      'shifts',
      'doc-1',
      { title: 'Night Shift', ownerId: 'u1' },
    );

    expect(AsyncStorage.setItem).toHaveBeenCalled();
    const savedQueue = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(savedQueue).toHaveLength(1);
    expect(savedQueue[0].operation).toBe('create');
    expect(savedQueue[0].synced).toBe(false);
  });

  it('does not sync edits when offline', async () => {
    const edit = {
      id: 'e-1',
      operation: 'create',
      collection: 'shifts',
      documentId: 'doc-1',
      data: { title: 'Test' },
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([edit]));

    await offlineEditQueueService.attemptSync();

    // shiftService.createShift should NOT be called since we're offline
    expect(shiftService.createShift).not.toHaveBeenCalled();
  });

  it('syncs edits when online', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    const edit = {
      id: 'e-1',
      operation: 'create',
      collection: 'shifts',
      documentId: 'doc-1',
      data: { title: 'Test' },
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([edit]));

    await offlineEditQueueService.attemptSync();

    expect(shiftService.createShift).toHaveBeenCalledWith({ title: 'Test' });
  });

  it('marks edits as synced after successful sync', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    const edit = {
      id: 'e-1',
      operation: 'create',
      collection: 'shifts',
      documentId: 'doc-1',
      data: { title: 'Test' },
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([edit]));

    await offlineEditQueueService.attemptSync();

    // Queue should be saved again with synced=true
    const savedCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
    const lastSave = JSON.parse(savedCalls[savedCalls.length - 1][1]);
    expect(lastSave[0].synced).toBe(true);
  });

  it('increments retry count on sync failure', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
    (shiftService.createShift as jest.Mock).mockRejectedValue(new Error('Firestore error'));

    const edit = {
      id: 'e-1',
      operation: 'create',
      collection: 'shifts',
      documentId: 'doc-1',
      data: { title: 'Test' },
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([edit]));

    await offlineEditQueueService.attemptSync();

    const lastSave = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls.slice(-1)[0][1],
    );
    expect(lastSave[0].retryCount).toBe(1);
    expect(lastSave[0].synced).toBe(false);
  });

  it('clearSyncedEdits removes only synced items', async () => {
    const queue = [
      { id: 'e-1', synced: true, retryCount: 0, timestamp: new Date().toISOString() },
      { id: 'e-2', synced: false, retryCount: 0, timestamp: new Date().toISOString() },
    ];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));

    await offlineEditQueueService.clearSyncedEdits();

    const lastSave = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls.slice(-1)[0][1],
    );
    expect(lastSave).toHaveLength(1);
    expect(lastSave[0].id).toBe('e-2');
  });

  it('full lifecycle: enqueue → go online → sync → clear', async () => {
    // Ensure createShift mock resolves successfully
    (shiftService.createShift as jest.Mock).mockResolvedValue({ id: 'shift-1' });
    
    // 1. Build the queue manually to avoid addToQueue's fire-and-forget attemptSync
    const queue = [{
      id: 'lifecycle-1',
      operation: 'create' as const,
      collection: 'shifts',
      documentId: 'doc-1',
      data: { title: 'Shift' },
      timestamp: new Date().toISOString(),
      synced: false,
      retryCount: 0,
    }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));

    // 2. Come back online
    (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

    // 3. Sync
    await offlineEditQueueService.attemptSync();
    expect(shiftService.createShift).toHaveBeenCalled();

    // 4. Clear synced
    const syncedQueue = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls.slice(-1)[0][1],
    );
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(syncedQueue));
    await offlineEditQueueService.clearSyncedEdits();

    const finalQueue = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls.slice(-1)[0][1],
    );
    expect(finalQueue).toHaveLength(0);
  });
});
