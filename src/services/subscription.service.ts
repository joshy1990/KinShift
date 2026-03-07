import { collection, query, where, getDocs, doc, updateDoc, addDoc, getDoc } from '@/config/firestore.compat';
import { COLLECTIONS, db } from '@/config/firebase.config';
import { notificationService } from './notification.service';
import { rbacService, AuditAction } from './rbac.service';
import { auditService } from './audit.service';
import { track } from '@/utils/telemetry';
import type { SubscriptionTier } from './revenueCat.service';

/**
 * Subscription Service
 *
 * Simplified two-tier model (aligned with RevenueCat "KinShift Pro" entitlement):
 *   Free — 1 household, 2 members, banner ads
 *   Pro  — unlimited households, 12 members/household, ad-free, calendar export
 *
 * The RevenueCat SDK (revenueCat.service.ts) is the source of truth for whether
 * a user is Pro. This service handles Firestore-side limits, display info, and
 * the downstream downgrade workflow when a subscription lapses.
 */

// Re-export the shared tier type so consumers don't need two imports
export type { SubscriptionTier } from './revenueCat.service';

export type SubscriptionStatus = 'active' | 'trialing' | 'expired' | 'canceled';

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionLimits {
  maxHouseholds: number;
  maxMembersPerHousehold: number;
  showAds: boolean;
  canUsePatterns: boolean;
  canUseTwoWeekView: boolean;
  canAddNotes: boolean;
  canExportCalendar: boolean;
}

export interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
}

export interface SubscriptionDisplayInfo {
  tierName: string;
  tierBadgeColor: string;
  statusText: string;
  statusColor: string;
  benefits: string[];
  showUpgrade: boolean;
}

// ---------------------------------------------------------------------------
// Tier limits
// ---------------------------------------------------------------------------

const PRO_LIMITS: SubscriptionLimits = {
  maxHouseholds: -1,              // unlimited
  maxMembersPerHousehold: 12,
  showAds: false,
  canUsePatterns: true,
  canUseTwoWeekView: true,
  canAddNotes: true,
  canExportCalendar: true,
};

const FREE_LIMITS: SubscriptionLimits = {
  maxHouseholds: 1,
  maxMembersPerHousehold: 2,
  showAds: true,
  canUsePatterns: true,
  canUseTwoWeekView: true,
  canAddNotes: true,
  canExportCalendar: false,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class SubscriptionService {
  /** Get limits for the given tier */
  getTierLimits(tier: SubscriptionTier): SubscriptionLimits {
    return tier === 'pro' ? { ...PRO_LIMITS } : { ...FREE_LIMITS };
  }

  /**
   * Resolve the effective tier, accounting for subscription status.
   * 'canceled' stays Pro until period end; 'expired' → free.
   */
  getEffectiveTier(subscription: Subscription): SubscriptionTier {
    if (subscription.status === 'expired') return 'free';

    if (subscription.status === 'canceled') {
      const periodEnd =
        subscription.currentPeriodEnd instanceof Date
          ? subscription.currentPeriodEnd
          : new Date(subscription.currentPeriodEnd);
      return new Date() > periodEnd ? 'free' : subscription.tier;
    }

    return subscription.tier;
  }

  getEffectiveTierLimits(subscription: Subscription): SubscriptionLimits {
    return this.getTierLimits(this.getEffectiveTier(subscription));
  }

  // ── Firestore subscription record ────────────────────────────────────

  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SUBSCRIPTIONS),
        where('userId', '==', userId),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return this.createDefaultSubscription(userId);

      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as Subscription;
    } catch (error) {
      console.error('Failed to get user subscription:', error);
      return {
        id: 'default',
        userId,
        tier: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  private async createDefaultSubscription(userId: string): Promise<Subscription> {
    const now = new Date();
    const sub: Omit<Subscription, 'id'> = {
      userId,
      tier: 'free',
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 365 * 86_400_000),
      createdAt: now,
      updatedAt: now,
    };

    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.SUBSCRIPTIONS), sub);
      return { id: docRef.id, ...sub };
    } catch {
      return { id: 'temp', ...sub };
    }
  }

  // ── Feature gates ────────────────────────────────────────────────────

  async canAddHousehold(userId: string): Promise<FeatureCheckResult> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) return { allowed: true };

      const limits = this.getEffectiveTierLimits(subscription);
      if (limits.maxHouseholds === -1) return { allowed: true };

      const householdsQuery = query(
        collection(db, COLLECTIONS.HOUSEHOLDS),
        where('members', 'array-contains', userId),
      );
      const snap = await getDocs(householdsQuery);
      const current = snap.size;

      if (current >= limits.maxHouseholds) {
        return {
          allowed: false,
          reason: 'Free plan is limited to 1 household. Upgrade to Pro for unlimited.',
          currentUsage: current,
          limit: limits.maxHouseholds,
        };
      }
      return { allowed: true, currentUsage: current, limit: limits.maxHouseholds };
    } catch (error) {
      console.error('Failed to check household limit:', error);
      track('tier_check_fail_closed', { scope: 'households', error: String(error) }, 'warn');
      return { allowed: false, reason: 'Unable to verify subscription. Please try again.' };
    }
  }

  async canAddMember(userId: string, householdId: string): Promise<FeatureCheckResult> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) return { allowed: true };

      const limits = this.getEffectiveTierLimits(subscription);
      if (limits.maxMembersPerHousehold === -1) return { allowed: true };

      const householdDocRef = doc(db, COLLECTIONS.HOUSEHOLDS, householdId);
      const householdDoc = await getDoc(householdDocRef);
      if (!householdDoc.exists()) return { allowed: false, reason: 'Household not found' };

      const current = householdDoc.data()?.members?.length ?? 0;

      if (current >= limits.maxMembersPerHousehold) {
        return {
          allowed: false,
          reason: `Free plan is limited to ${limits.maxMembersPerHousehold} members. Upgrade to Pro for more.`,
          currentUsage: current,
          limit: limits.maxMembersPerHousehold,
        };
      }
      return { allowed: true, currentUsage: current, limit: limits.maxMembersPerHousehold };
    } catch (error) {
      console.error('Failed to check member limit:', error);
      track('tier_check_fail_closed', { scope: 'members', householdId, error: String(error) }, 'warn');
      return { allowed: false, reason: 'Unable to verify subscription. Please try again.' };
    }
  }

  // ── Ads ──────────────────────────────────────────────────────────────

  /** Simple ad check: Pro users never see ads */
  shouldShowAds(tier: SubscriptionTier): boolean {
    return tier !== 'pro';
  }

  // ── Display info ─────────────────────────────────────────────────────

  getSubscriptionDisplayInfo(subscription: Subscription): SubscriptionDisplayInfo {
    const effective = this.getEffectiveTier(subscription);

    let statusText = 'Active';
    let statusColor = '#10B981';
    if (subscription.status === 'canceled') {
      statusText = 'Canceled';
      statusColor = '#EF4444';
    } else if (subscription.status === 'expired') {
      statusText = 'Expired';
      statusColor = '#EF4444';
    }

    const isPro = effective === 'pro';

    return {
      tierName: isPro ? 'Pro' : 'Free',
      tierBadgeColor: isPro ? '#F59E0B' : '#6B7280',
      statusText,
      statusColor,
      benefits: isPro
        ? [
            'Unlimited households',
            'Up to 12 members per household',
            'Ad-free experience',
            'Calendar export',
            'Priority support',
          ]
        : [
            '1 household',
            'Up to 2 members',
            'Unlimited shifts & notes',
            'All core features',
          ],
      showUpgrade: !isPro,
    };
  }

  // ── Cancellation / downgrade workflow ────────────────────────────────

  /**
   * Cancel subscription.
   * The actual billing cancellation happens via the App/Play Store.
   * This marks the Firestore record and triggers the downgrade workflow.
   */
  async cancelSubscription(userId: string, householdId?: string): Promise<Subscription> {
    const currentSubscription = await this.getUserSubscription(userId);
    if (!currentSubscription) throw new Error('No subscription found');

    if (householdId) {
      const adminCheck = await rbacService.enforceAdminOnly(
        householdId, userId, AuditAction.SUBSCRIPTION_CANCEL,
      );
      if (!adminCheck.allowed) throw new Error(adminCheck.reason || 'Unauthorized');
    }

    const now = new Date();
    const patch: Partial<Subscription> = { status: 'canceled', canceledAt: now, updatedAt: now };

    await updateDoc(doc(db, COLLECTIONS.SUBSCRIPTIONS, currentSubscription.id), patch);

    if (householdId) {
      await auditService.logHouseholdAction(
        householdId, userId, AuditAction.SUBSCRIPTION_CANCEL, { cancelled: true },
      );
    }

    // Fire-and-forget downgrade workflow
    this.processSubscriptionDowngrade(userId, currentSubscription.tier).catch(e =>
      console.warn('[SubscriptionService] Downgrade workflow failed:', e),
    );

    return { ...currentSubscription, ...patch } as Subscription;
  }

  private async processSubscriptionDowngrade(userId: string, previousTier: string): Promise<void> {
    const householdsQuery = query(
      collection(db, COLLECTIONS.HOUSEHOLDS),
      where('admins', 'array-contains', userId),
    );
    const snap = await getDocs(householdsQuery);
    if (snap.empty) return;

    const freeLimits = this.getTierLimits('free');
    const affected: Array<{ name: string; memberCount: number; tierLimit: number }> = [];

    for (const hDoc of snap.docs) {
      const h = hDoc.data();
      const excess = Math.max(0, (h.members?.length ?? 0) - freeLimits.maxMembersPerHousehold);

      await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, hDoc.id), {
        subscribedTier: 'free',
        tierSyncedAt: new Date(),
        ...(excess > 0 ? { downgradeWarningAt: new Date() } : {}),
        updatedAt: new Date(),
      });

      if (excess > 0) {
        affected.push({
          name: h.name,
          memberCount: h.members.length,
          tierLimit: freeLimits.maxMembersPerHousehold,
        });

        const memberIds = h.members.map((m: any) => m.userId);
        await notificationService
          .notifyHouseholdDowngrade(hDoc.id, memberIds, previousTier, 'free')
          .catch(e => console.warn('Downgrade notify failed:', e));
      }
    }

    if (affected.length > 0) {
      await notificationService
        .notifySubscriptionCanceled(userId, affected)
        .catch(e => console.warn('Cancel notify failed:', e));
    }
  }
}

export const subscriptionService = new SubscriptionService();
