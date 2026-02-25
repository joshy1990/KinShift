/**
 * Unit tests for useConnectivity hooks
 */

jest.mock('@/services/network.service', () => ({
  networkService: {
    getCurrentStatus: jest.fn(() => ({
      isConnected: true,
      type: 'wifi',
      isInternetReachable: true,
    })),
    getConnectionDescription: jest.fn(() => 'WiFi'),
    getNetworkQuality: jest.fn(() => 'excellent'),
    addListener: jest.fn((cb) => {
      // Immediately invoke with current status
      cb({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });
      return jest.fn(); // unsubscribe
    }),
  },
}));

jest.mock('@/services/offlineEditQueue.service', () => ({
  offlineEditQueueService: {
    getPendingCount: jest.fn().mockResolvedValue(0),
    getQueue: jest.fn().mockResolvedValue([]),
    addQueueListener: jest.fn(() => jest.fn()),
    attemptSync: jest.fn().mockResolvedValue(undefined),
    clearSyncedEdits: jest.fn().mockResolvedValue(undefined),
  },
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useNetworkStatus, useOfflineSync, useConnectivity } from '@/hooks/useConnectivity';

describe('useNetworkStatus', () => {
  it('returns initial network status', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.connectionDescription).toBe('WiFi');
    expect(result.current.networkQuality).toBe('excellent');
  });

  it('has expected shape', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('type');
    expect(result.current).toHaveProperty('connectionDescription');
    expect(result.current).toHaveProperty('networkQuality');
  });
});

describe('useOfflineSync', () => {
  it('returns initial sync state', async () => {
    const { result } = renderHook(() => useOfflineSync());

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
    expect(result.current.isSyncing).toBe(false);
  });

  it('has forceSync function', () => {
    const { result } = renderHook(() => useOfflineSync());
    expect(typeof result.current.forcSync).toBe('function');
  });

  it('has clearSynced function', () => {
    const { result } = renderHook(() => useOfflineSync());
    expect(typeof result.current.clearSynced).toBe('function');
  });
});

describe('useConnectivity', () => {
  it('combines network and sync status', async () => {
    const { result } = renderHook(() => useConnectivity());

    expect(result.current.network).toBeDefined();
    expect(result.current.sync).toBeDefined();
    expect(typeof result.current.isFullyOnline).toBe('boolean');
    expect(typeof result.current.canSync).toBe('boolean');
  });

  it('isFullyOnline is true when connected with internet', async () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current.isFullyOnline).toBe(true);
  });

  it('canSync is false when pendingCount is 0', async () => {
    const { result } = renderHook(() => useConnectivity());
    
    await waitFor(() => {
      expect(result.current.canSync).toBe(false);
    });
  });
});
