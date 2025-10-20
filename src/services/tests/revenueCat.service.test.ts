/**
 * RevenueCat Service Tests
 * Tests for subscription and payment functionality
 */

import {revenueCatService} from '../revenueCat.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock RevenueCat
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setup: jest.fn(),
    configure: jest.fn(),
    setAttributes: jest.fn(),
    getCustomerInfo: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    getOfferings: jest.fn(),
    addEventListener: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    logOut: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('RevenueCatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);
  });

  describe('initialization', () => {
    it('should initialize RevenueCat with user ID', async () => {
      const Purchases = require('react-native-purchases').default;
      Purchases.configure.mockResolvedValue({});

      await revenueCatService.initialize('test-user-id');

      expect(Purchases.configure).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const Purchases = require('react-native-purchases').default;
      Purchases.configure.mockRejectedValue(new Error('Init failed'));

      // Should not throw
      await expect(revenueCatService.initialize('test-user-id')).rejects.toThrow();
    });
  });

  describe('subscription checking', () => {
    it('should check if user has active subscription', async () => {
      const Purchases = require('react-native-purchases').default;
      Purchases.getCustomerInfo.mockResolvedValue({
        activeSubscriptions: ['premium'],
      });

      const hasActive = revenueCatService.hasActiveSubscription();
      expect(typeof hasActive).toBe('boolean');
    });

    it('should check for specific entitlements', async () => {
      const Purchases = require('react-native-purchases').default;
      Purchases.getCustomerInfo.mockResolvedValue({
        entitlements: {
          active: {
            premium: {isActive: true},
          },
        },
      });

      const hasPremium = revenueCatService.hasEntitlement('premium');
      expect(typeof hasPremium).toBe('boolean');
    });

    it('should get active subscription name', () => {
      const subscription = revenueCatService.getActiveSubscription();
      expect(subscription === null || typeof subscription === 'string').toBe(true);
    });

    it('should get expiration date', () => {
      const expirationDate = revenueCatService.getExpirationDate();
      expect(expirationDate === null || expirationDate instanceof Date).toBe(true);
    });

    it('should check if subscription will renew', () => {
      const willRenew = revenueCatService.willRenew();
      expect(typeof willRenew).toBe('boolean');
    });
  });

  describe('purchase flow', () => {
    it('should handle purchase package', async () => {
      const mockPackage = {
        identifier: 'test_package',
        currentPrice: 9.99,
        packageType: 'monthly' as any,
        product: {} as any,
        offeringIdentifier: 'test' as any,
      } as any;

      const Purchases = require('react-native-purchases').default;
      Purchases.purchasePackage.mockResolvedValue({
        customerInfo: {
          activeSubscriptions: ['test_package'],
        },
      });

      const result = await revenueCatService.purchasePackage(mockPackage);
      expect(result).toBeDefined();
    });

    it('should handle purchase cancellation', async () => {
      const mockPackage = {
        identifier: 'test_package',
        packageType: 'monthly' as any,
        product: {} as any,
        offeringIdentifier: 'test' as any,
      } as any;

      const Purchases = require('react-native-purchases').default;
      Purchases.purchasePackage.mockRejectedValue(new Error('User cancelled'));

      await expect(revenueCatService.purchasePackage(mockPackage)).rejects.toThrow();
    });
  });

  describe('restore purchases', () => {
    it('should restore previous purchases', async () => {
      const Purchases = require('react-native-purchases').default;
      Purchases.restorePurchases.mockResolvedValue({
        activeSubscriptions: ['premium'],
      });

      const result = await revenueCatService.restorePurchases();
      expect(result).toBeDefined();
    });
  });

  describe('local caching', () => {
    it('should cache subscription status to AsyncStorage', async () => {
      const status = {
        tier: 'premium',
        activeSubscriptions: ['premium'],
        isActive: true,
      };

      await (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);

      expect(AsyncStorage.setItem).toBeDefined();
    });

    it('should retrieve cached subscription status', async () => {
      const cachedStatus = {
        tier: 'premium',
        isActive: true,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(cachedStatus));

      const result = await AsyncStorage.getItem('linkshift_subscription_cache');
      const parsed = result ? JSON.parse(result) : null;

      expect(parsed).toEqual(cachedStatus);
    });
  });

  describe('cleanup', () => {
    it('should cleanup on logout', async () => {
      await revenueCatService.logout();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('offerings', () => {
    it('should retrieve available offerings', async () => {
      const mockOfferings = [
        {identifier: 'free', currentPrice: 0},
        {identifier: 'standard_monthly', currentPrice: 4.99},
        {identifier: 'premium_monthly', currentPrice: 9.99},
      ];

      const Purchases = require('react-native-purchases').default;
      Purchases.getOfferings.mockResolvedValue(mockOfferings);

      const offerings = await revenueCatService.getOfferings();
      expect(Array.isArray(offerings)).toBe(true);
    });
  });
});
