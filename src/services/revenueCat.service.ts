/**
 * RevenueCat Subscription Service
 *
 * Simplified two-tier model:
 *   Free  — ad-supported, 1 household, 2 members
 *   Pro   — ad-free, unlimited households, 12 members/household, calendar export
 *
 * Single entitlement: "KinShift Pro"
 * Products configured in RevenueCat dashboard: monthly & yearly
 */

import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOfferings,
  LOG_LEVEL,
} from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Public SDK key — loaded from app.config.js extra → .env.local / EAS Secrets */
const REVENUECAT_API_KEY =
  Constants.expoConfig?.extra?.revenuecatApiKey || '';

if (__DEV__ && !REVENUECAT_API_KEY) {
  console.warn(
    '[RevenueCat] API key not configured. Set REVENUECAT_API_KEY in .env.local',
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The single entitlement that gates all Pro features */
export const PRO_ENTITLEMENT = 'KinShift Pro';

/**
 * Legacy entitlement IDs — checked as fallback so users who purchased
 * under the old standard/premium model keep their access.
 */
const LEGACY_ENTITLEMENTS = ['premium', 'standard'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'pro';

export interface ProStatus {
  isPro: boolean;
  tier: SubscriptionTier;
  willRenew: boolean;
  expirationDate: Date | null;
  activeProductId: string | null;
  billingIssue: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class RevenueCatService {
  private initialized = false;
  private customerInfo: CustomerInfo | null = null;
  private onCustomerInfoUpdated: ((info: CustomerInfo) => void) | null = null;

  // ── Callbacks ──────────────────────────────────────────────────────────

  /** Register a callback for real-time CustomerInfo changes (used by SubscriptionContext) */
  setCustomerInfoUpdateCallback(
    callback: ((info: CustomerInfo) => void) | null,
  ): void {
    this.onCustomerInfoUpdated = callback;
  }

  // ── Initialisation ─────────────────────────────────────────────────────

  /**
   * Configure the RevenueCat SDK and log in the given user.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async initialize(userId: string): Promise<void> {
    if (this.initialized) return;

    try {
      if (!REVENUECAT_API_KEY) {
        console.warn('[RevenueCat] No API key — skipping init');
        return;
      }

      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      // Configure SDK
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });

      // Identify user (creates or retrieves the RC customer)
      const { customerInfo } = await Purchases.logIn(userId);
      this.customerInfo = customerInfo;

      // Listen for future changes (upgrades, cancels, renewals, billing issues)
      Purchases.addCustomerInfoUpdateListener(this.handleCustomerInfoUpdate);

      this.initialized = true;
      await this.persistStatus();

      console.log('[RevenueCat] Initialised for user', userId);
    } catch (error) {
      console.error('[RevenueCat] Initialisation failed:', error);
      // App continues in free tier — non-fatal
    }
  }

  // ── Entitlement checks ─────────────────────────────────────────────────

  /** Whether the user has *any* Pro-granting entitlement (new or legacy). */
  get isPro(): boolean {
    const active = this.customerInfo?.entitlements?.active;
    if (!active) return false;

    // New entitlement
    if (active[PRO_ENTITLEMENT]?.isActive) return true;

    // Legacy entitlements (old standard/premium purchasers)
    for (const id of LEGACY_ENTITLEMENTS) {
      if (active[id]?.isActive) return true;
    }

    return false;
  }

  /** Convenience: current tier */
  get tier(): SubscriptionTier {
    return this.isPro ? 'pro' : 'free';
  }

  /** Full Pro status snapshot (for UI) */
  getProStatus(): ProStatus {
    const entitlement =
      this.customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT] ??
      this.findLegacyEntitlement();

    return {
      isPro: this.isPro,
      tier: this.tier,
      willRenew: entitlement?.willRenew ?? false,
      expirationDate: entitlement?.expirationDate
        ? new Date(entitlement.expirationDate)
        : null,
      activeProductId: entitlement?.productIdentifier ?? null,
      billingIssue:
        entitlement?.billingIssueDetectedAt != null,
    };
  }

  // ── Offerings / Purchasing ─────────────────────────────────────────────

  /** Get all available packages from the current offering */
  async getOfferings(): Promise<PurchasesPackage[]> {
    try {
      const offerings: PurchasesOfferings = await Purchases.getOfferings();

      if (!offerings.current) {
        console.warn('[RevenueCat] No current offering configured');
        return [];
      }

      return offerings.current.availablePackages ?? [];
    } catch (error) {
      console.error('[RevenueCat] Failed to get offerings:', error);
      return [];
    }
  }

  /** Purchase a specific package. Throws on failure (caller handles UI). */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    this.customerInfo = customerInfo;
    await this.persistStatus();
    return customerInfo;
  }

  /** Restore previous purchases (e.g. after reinstall) */
  async restorePurchases(): Promise<CustomerInfo> {
    const customerInfo = await Purchases.restorePurchases();
    this.customerInfo = customerInfo;
    await this.persistStatus();
    return customerInfo;
  }

  // ── Customer Info ──────────────────────────────────────────────────────

  /** Force-refresh customer info from the RevenueCat backend */
  async refreshCustomerInfo(): Promise<CustomerInfo | null> {
    try {
      const info = await Purchases.getCustomerInfo();
      this.customerInfo = info;
      await this.persistStatus();
      return info;
    } catch (error) {
      console.error('[RevenueCat] Refresh failed:', error);
      return null;
    }
  }

  /** Current in-memory customer info (may be null before init). */
  getCustomerInfo(): CustomerInfo | null {
    return this.customerInfo;
  }

  // ── Cached / Offline Status ────────────────────────────────────────────

  /** Read the last-saved status from AsyncStorage (for instant splash-screen UI). */
  async getCachedStatus(): Promise<ProStatus | null> {
    try {
      const raw = await AsyncStorage.getItem('@kinshift/subscription_status');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    try {
      await Purchases.logOut();
    } catch (error) {
      console.warn('[RevenueCat] logOut error (may already be anonymous):', error);
    }
    this.customerInfo = null;
    this.initialized = false;
    await AsyncStorage.removeItem('@kinshift/subscription_status');
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private handleCustomerInfoUpdate = async (info: CustomerInfo) => {
    this.customerInfo = info;
    await this.persistStatus();
    this.onCustomerInfoUpdated?.(info);
  };

  private findLegacyEntitlement() {
    const active = this.customerInfo?.entitlements?.active;
    if (!active) return undefined;
    for (const id of LEGACY_ENTITLEMENTS) {
      if (active[id]?.isActive) return active[id];
    }
    return undefined;
  }

  private async persistStatus(): Promise<void> {
    try {
      const status = this.getProStatus();
      await AsyncStorage.setItem(
        '@kinshift/subscription_status',
        JSON.stringify(status),
      );
    } catch {
      // Non-critical — cached status is a nicety, not a requirement
    }
  }
}

export const revenueCatService = new RevenueCatService();
