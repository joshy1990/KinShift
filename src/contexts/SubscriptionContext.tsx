/**
 * Subscription Context
 *
 * Provides the current subscription state (Free / Pro) to the entire app.
 * The RevenueCat SDK is the single source of truth — this context just
 * exposes its data via React state so components can re-render reactively.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { revenueCatService, SubscriptionTier, ProStatus } from '@/services/revenueCat.service';
import { subscriptionService } from '@/services/subscription.service';
import { useAuth } from '@/contexts/AuthContext';
import { CustomerInfo } from 'react-native-purchases';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface SubscriptionContextType {
  /** True while RevenueCat is being initialised */
  isLoading: boolean;

  /** Raw CustomerInfo from RevenueCat (may be null before init) */
  customerInfo: CustomerInfo | null;

  /** Whether the user has an active Pro subscription */
  isPro: boolean;

  /** 'free' | 'pro' */
  tier: SubscriptionTier;

  /** Full status snapshot (expiry, billing issue, etc.) */
  proStatus: ProStatus;

  /** Tier limits for current subscription */
  limits: {
    maxHouseholds: number;
    maxMembersPerHousehold: number;
    showAds: boolean;
    canExportCalendar: boolean;
  };

  /** Restore previous purchases (after reinstall) */
  restorePurchases: () => Promise<boolean>;

  /** Whether ads should be shown */
  shouldShowAds: boolean;
}

const DEFAULT_STATUS: ProStatus = {
  isPro: false,
  tier: 'free',
  willRenew: false,
  expirationDate: null,
  activeProductId: null,
  billingIssue: false,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [proStatus, setProStatus] = useState<ProStatus>(DEFAULT_STATUS);

  // ── Bootstrap ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setProStatus(DEFAULT_STATUS);
      setCustomerInfo(null);
      return;
    }

    let cancelled = false;

    const setup = async () => {
      try {
        setIsLoading(true);

        // Initialise RevenueCat (identifies user, starts listener)
        await revenueCatService.initialize(user.id);

        // Register callback for real-time updates
        revenueCatService.setCustomerInfoUpdateCallback((info) => {
          if (cancelled) return;
          setCustomerInfo(info);
          setProStatus(revenueCatService.getProStatus());
        });

        // Read current state
        const info = await revenueCatService.refreshCustomerInfo();
        if (!cancelled) {
          setCustomerInfo(info);
          setProStatus(revenueCatService.getProStatus());
        }
      } catch (error) {
        console.error('[SubscriptionContext] Setup failed:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    setup();

    return () => {
      cancelled = true;
      revenueCatService.setCustomerInfoUpdateCallback(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Restore purchases ────────────────────────────────────────────────

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await revenueCatService.restorePurchases();
      setCustomerInfo(info);
      setProStatus(revenueCatService.getProStatus());
      return revenueCatService.isPro;
    } catch (error) {
      console.error('[SubscriptionContext] Restore failed:', error);
      return false;
    }
  }, []);

  // ── Derived values ───────────────────────────────────────────────────

  const limits = subscriptionService.getTierLimits(proStatus.tier);

  const value: SubscriptionContextType = {
    isLoading,
    customerInfo,
    isPro: proStatus.isPro,
    tier: proStatus.tier,
    proStatus,
    limits: {
      maxHouseholds: limits.maxHouseholds,
      maxMembersPerHousehold: limits.maxMembersPerHousehold,
      showAds: limits.showAds,
      canExportCalendar: limits.canExportCalendar,
    },
    restorePurchases,
    shouldShowAds: subscriptionService.shouldShowAds(proStatus.tier),
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};
