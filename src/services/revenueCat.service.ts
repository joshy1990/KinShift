/**
 * RevenueCat Subscription Service
 * Handles all payment processing and subscription management
 */

import Purchases, {
  CustomerInfo,
  PurchasesPackage,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// RevenueCat API Key - loaded from environment variables
const REVENUECAT_API_KEY = process.env.REVENUECAT_API_KEY || 'appl_XXXXXXXXXXXXXXXXXXXXxx';

// Product IDs for subscription tiers
export const SUBSCRIPTION_PRODUCTS = {
  FREE: 'free',
  STANDARD: 'kinshift_standard_monthly',
  PREMIUM: 'kinshift_premium_monthly',
};

// Entitlements (in RevenueCat)
export const ENTITLEMENTS = {
  PREMIUM: 'premium',
  STANDARD: 'standard',
};

export interface RevenueCatCustomerInfo {
  customerId: string;
  originalAppUserId: string;
  activeSubscriptions: string[];
  allPurchasedProductIdentifiers: string[];
  entitlements: {
    active: {
      [key: string]: Entitlement;
    };
  };
  firstSeen: string;
  originalPurchaseDate?: string;
  requestDate: string;
}

export interface Entitlement {
  identifier: string;
  isActive: boolean;
  willRenew: boolean;
  billingIssueDetected: boolean;
  isSandbox: boolean;
  originalPurchaseDate: string;
  purchaseDate: string;
  expirationDate?: string;
}

export interface SubscriptionOfference {
  identifier: string;
  title: string;
  description: string;
  priceString: string;
  price: number;
  locale: string;
  currencyCode: string;
  localizedTitle: string;
  localizedDescription: string;
}

class RevenueCatService {
  private initialized = false;
  private customerInfo: CustomerInfo | null = null;

  /**
   * Initialize RevenueCat
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Initialize RevenueCat with API key
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
      });

      // Set user ID
      await Purchases.setAttributes({
        userId,
      });

      // Setup purchase listener
      this.setupPurchaseListener();

  this.initialized = true;

      // Get initial customer info
      await this.refreshCustomerInfo();
    } catch (error) {
      console.error('[RevenueCat] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup listener for purchase updates
   */
  private setupPurchaseListener(): void {
    Purchases.addCustomerInfoUpdateListener(async (customerInfo: CustomerInfo) => {
      this.customerInfo = customerInfo;
      console.log('[RevenueCat] Customer info updated');

      // Save subscription status locally
      await this.saveSubscriptionStatus(customerInfo);
    });
  }

  /**
   * Refresh customer info
   */
  async refreshCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      this.customerInfo = customerInfo;
      await this.saveSubscriptionStatus(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Failed to refresh customer info:', error);
      return null;
    }
  }

  /**
   * Get available packages for a product
   */
  async getOfferings(): Promise<PurchasesPackage[]> {
    try {
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        console.warn('[RevenueCat] No current offering found');
        return [];
      }

      return offerings.current.availablePackages || [];
    } catch (error) {
      console.error('[RevenueCat] Failed to get offerings:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   */
  async purchasePackage(aPackage: PurchasesPackage): Promise<CustomerInfo | null> {
    try {
      const result = await Purchases.purchasePackage(aPackage);
      const customerInfo = result.customerInfo as CustomerInfo;
      this.customerInfo = customerInfo;
      await this.saveSubscriptionStatus(customerInfo);
      return customerInfo;
    } catch (error: any) {
      // Surface error to caller so UI/tests can handle cancellation or failures
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[RevenueCat] Purchase failed:', err);
      throw err;
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<CustomerInfo | null> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      this.customerInfo = customerInfo;
      await this.saveSubscriptionStatus(customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Failed to restore purchases:', error);
      return null;
    }
  }

  /**
   * Get active subscription
   */
  getActiveSubscription(): string | null {
    if (!this.customerInfo) {
      return null;
    }

    const activeSubscriptions = this.customerInfo.activeSubscriptions || [];
    if (activeSubscriptions.length > 0) {
      return activeSubscriptions[0];
    }

    // Check entitlements as fallback
    const entitlements = this.customerInfo.entitlements?.active || {};
    if (entitlements[ENTITLEMENTS.PREMIUM]) {
      return SUBSCRIPTION_PRODUCTS.PREMIUM;
    }
    if (entitlements[ENTITLEMENTS.STANDARD]) {
      return SUBSCRIPTION_PRODUCTS.STANDARD;
    }

    return null;
  }

  /**
   * Check if user has active subscription
   */
  hasActiveSubscription(): boolean {
    return this.getActiveSubscription() !== null;
  }

  /**
   * Check if user has entitlement
   */
  hasEntitlement(entitlementId: string): boolean {
    if (!this.customerInfo) {
      return false;
    }

    const activeEntitlements = this.customerInfo.entitlements?.active || {};
    return !!activeEntitlements[entitlementId];
  }

  /**
   * Get subscription expiration date
   */
  getExpirationDate(): Date | null {
    if (!this.customerInfo) {
      return null;
    }

    const activeSubscriptions = this.customerInfo.activeSubscriptions || [];
    if (activeSubscriptions.length === 0) {
      return null;
    }

    // Get the first active subscription's expiration
    const allExpirations = this.customerInfo.allExpirationDates || {};
    const firstSubscription = activeSubscriptions[0];
    const expirationString = allExpirations[firstSubscription];

    if (expirationString && typeof expirationString === 'string') {
      return new Date(expirationString);
    }

    return null;
  }

  /**
   * Check if subscription will renew
   */
  willRenew(): boolean {
    if (!this.customerInfo) {
      return false;
    }

    const activeSubscriptions = this.customerInfo.activeSubscriptions || [];
    if (activeSubscriptions.length === 0) {
      return false;
    }

    // Check if there are any active subscriptions (indicates renewal)
    return activeSubscriptions.length > 0;
  }

  /**
   * Get customer info
   */
  getCustomerInfo(): CustomerInfo | null {
    return this.customerInfo;
  }

  /**
   * Save subscription status locally
   */
  private async saveSubscriptionStatus(customerInfo: CustomerInfo): Promise<void> {
    try {
      const status = {
        hasActiveSubscription: this.hasActiveSubscription(),
        activeSubscription: this.getActiveSubscription(),
        expirationDate: this.getExpirationDate(),
        willRenew: this.willRenew(),
        hasStandardEntitlement: this.hasEntitlement(ENTITLEMENTS.STANDARD),
        hasPremiumEntitlement: this.hasEntitlement(ENTITLEMENTS.PREMIUM),
      };

  await AsyncStorage.setItem('@kinshift/subscription_status', JSON.stringify(status));
    } catch (error) {
      console.error('[RevenueCat] Failed to save subscription status:', error);
    }
  }

  /**
   * Get cached subscription status
   */
  async getCachedSubscriptionStatus(): Promise<any> {
    try {
  const cached = await AsyncStorage.getItem('@kinshift/subscription_status');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[RevenueCat] Failed to get cached status:', error);
      return null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await Purchases.logOut();
      this.customerInfo = null;
      this.initialized = false;
  await AsyncStorage.removeItem('@kinshift/subscription_status');
    } catch (error) {
      console.error('[RevenueCat] Logout failed:', error);
    }
  }
}

export const revenueCatService = new RevenueCatService();
