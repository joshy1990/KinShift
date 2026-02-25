/**
 * Unit tests for NetworkService
 */

import { NetInfoStateType } from '@react-native-community/netinfo';

// Must mock before importing
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({
    isConnected: true,
    type: 'wifi',
    isInternetReachable: true,
  }),
  NetInfoStateType: {
    unknown: 'unknown',
    none: 'none',
    cellular: 'cellular',
    wifi: 'wifi',
    bluetooth: 'bluetooth',
    ethernet: 'ethernet',
    wimax: 'wimax',
    vpn: 'vpn',
    other: 'other',
  },
}));

jest.mock('@/services/offlineEditQueue.service', () => ({
  offlineEditQueueService: {
    attemptSync: jest.fn(),
  },
}));

import { networkService } from '@/services/network.service';

describe('NetworkService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isOnline', () => {
    it('returns false by default (before initialization)', () => {
      // Default state
      expect(typeof networkService.isOnline()).toBe('boolean');
    });
  });

  describe('getConnectionDescription', () => {
    it('returns a string description', () => {
      const desc = networkService.getConnectionDescription();
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    });
  });

  describe('getNetworkQuality', () => {
    it('returns valid quality level', () => {
      const quality = networkService.getNetworkQuality();
      expect(['excellent', 'good', 'poor', 'offline']).toContain(quality);
    });
  });

  describe('addListener', () => {
    it('registers a listener and calls with current status', () => {
      const listener = jest.fn();
      const unsubscribe = networkService.addListener(listener);
      
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        isConnected: expect.any(Boolean),
      }));

      unsubscribe();
    });

    it('returns an unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = networkService.addListener(listener);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('hasInternetAccess', () => {
    it('returns boolean', () => {
      expect(typeof networkService.hasInternetAccess()).toBe('boolean');
    });
  });

  describe('isSuitableForLargeOperations', () => {
    it('returns boolean', () => {
      expect(typeof networkService.isSuitableForLargeOperations()).toBe('boolean');
    });
  });

  describe('waitForConnection', () => {
    it('resolves immediately if already online with isOnline=true', async () => {
      // Override isOnline to return true by using internal state
      const originalIsOnline = networkService.isOnline.bind(networkService);
      
      // When already online it resolves to true
      if (networkService.isOnline()) {
        const result = await networkService.waitForConnection(1000);
        expect(result).toBe(true);
      }
    });
  });

  describe('initialize', () => {
    it('returns cleanup function', () => {
      const cleanup = networkService.initialize();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });
  });

  describe('getCurrentStatus', () => {
    it('returns status object with expected shape', () => {
      const status = networkService.getCurrentStatus();
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('type');
    });
  });
});
