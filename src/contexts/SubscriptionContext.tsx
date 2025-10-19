/**
 * Subscription Context
 * Manages subscription state throughout the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { revenueCatService } from '@/services/revenueCat.service';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionService } from '@/services/subscription.service';
import { CustomerInfo } from 'react-native-purchases';

export interface SubscriptionContextType {
  // RevenueCat data
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  hasActiveSubscription: boolean;
  activeSubscription: string | null;
  expirationDate: Date | null;
  willRenew: boolean;

  // Tier information
  currentTier: 'free' | 'standard' | 'premium';
  features: {
    maxHouseholds: number;
    maxMembersPerHousehold: number;
    adsFree: boolean;
  };

  // Actions
  purchaseSubscription: (productId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentTier, setCurrentTier] = useState<'free' | 'standard' | 'premium'>('free');

  // Initialize RevenueCat when user logs in
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const setupSubscriptions = async () => {
      try {
        setIsLoading(true);

        // Initialize RevenueCat
        await revenueCatService.initialize(user.id);

        // Get customer info
        const info = await revenueCatService.refreshCustomerInfo();
        setCustomerInfo(info);

        // Determine tier based on entitlements or subscription
        const hasActive = revenueCatService.hasActiveSubscription();
        const hasPremium = revenueCatService.hasEntitlement('premium');
        const hasStandard = revenueCatService.hasEntitlement('standard');

        if (hasPremium) {
          setCurrentTier('premium');
        } else if (hasStandard) {
          setCurrentTier('standard');
        } else {
          setCurrentTier('free');
        }

        // Sync with Firestore subscription service
        await syncWithFirestore(user.id, hasActive ? (hasPremium ? 'premium' : 'standard') : 'free');
      } catch (error) {
        console.error('[SubscriptionContext] Setup failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    setupSubscriptions();
  }, [user?.id]);

  const syncWithFirestore = async (userId: string, tier: 'free' | 'standard' | 'premium') => {
    try {
      // Update subscription tier in Firestore if it changed
      await subscriptionService.changeSubscriptionTier(userId, tier);
    } catch (error) {
      console.warn('[SubscriptionContext] Failed to sync with Firestore:', error);
    }
  };

  const purchaseSubscription = async (packageId: string): Promise<boolean> => {
    try {
      const offerings = await revenueCatService.getOfferings();
      const package_ = offerings.find((p) => p.identifier === packageId);

      if (!package_) {
        console.error('[SubscriptionContext] Package not found:', packageId);
        return false;
      }

      const result = await revenueCatService.purchasePackage(package_);

      if (result) {
        setCustomerInfo(result);

        // Update local tier
        const hasPremium = revenueCatService.hasEntitlement('premium');
        const hasStandard = revenueCatService.hasEntitlement('standard');

        if (hasPremium) {
          setCurrentTier('premium');
        } else if (hasStandard) {
          setCurrentTier('standard');
        }

        // Sync with Firestore
        if (user?.id) {
          await syncWithFirestore(user.id, hasPremium ? 'premium' : hasStandard ? 'standard' : 'free');
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('[SubscriptionContext] Purchase failed:', error);
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      const result = await revenueCatService.restorePurchases();

      if (result) {
        setCustomerInfo(result);

        // Update local tier
        const hasPremium = revenueCatService.hasEntitlement('premium');
        const hasStandard = revenueCatService.hasEntitlement('standard');

        if (hasPremium) {
          setCurrentTier('premium');
        } else if (hasStandard) {
          setCurrentTier('standard');
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('[SubscriptionContext] Restore failed:', error);
      return false;
    }
  };

  // Get tier features
  const getFeatures = (tier: string) => {
    switch (tier) {
      case 'premium':
        return {
          maxHouseholds: 999,
          maxMembersPerHousehold: 12,
          adsFree: true,
        };
      case 'standard':
        return {
          maxHouseholds: 1,
          maxMembersPerHousehold: 4,
          adsFree: false,
        };
      case 'free':
      default:
        return {
          maxHouseholds: 1,
          maxMembersPerHousehold: 2,
          adsFree: false,
        };
    }
  };

  const value: SubscriptionContextType = {
    isLoading,
    customerInfo,
    hasActiveSubscription: revenueCatService.hasActiveSubscription(),
    activeSubscription: revenueCatService.getActiveSubscription(),
    expirationDate: revenueCatService.getExpirationDate(),
    willRenew: revenueCatService.willRenew(),
    currentTier,
    features: getFeatures(currentTier),
    purchaseSubscription,
    restorePurchases,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};
