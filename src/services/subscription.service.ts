import { collection, query, where, getDocs, doc, updateDoc, addDoc, getDoc } from '@/config/firestore.compat';
import {COLLECTIONS, db} from '@/config/firebase.config';
import { notificationService } from './notification.service';
import { rbacService, AuditAction } from './rbac.service';
import { auditService } from './audit.service';
import { track } from '@/utils/telemetry';

/**
 * Subscription Service
 * Manages subscription tiers, feature gating, and trial periods
 * 
 * Tier Structure:
 * - FREE: 1 household, 2 members, all features, banner ads
 * - STANDARD (£2.99/mo): 1 household, 4 members, ads removed for admin
 * - PREMIUM (£7.99/mo): Unlimited households, 12 members/household, ad-free, priority support
 */

export type SubscriptionTier = 'free' | 'standard' | 'premium';
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
  showAdsToAdmin: boolean;
  showAdsToMembers: boolean;
  canUsePatterns: boolean;
  canUseTwoWeekView: boolean;
  canAddNotes: boolean;
  hasPrioritySupport: boolean;
  canExportCalendar: boolean;
  removesAdsForHousehold?: boolean; // Premium feature: removes ads for entire household
}

export interface PricingInfo {
  tier: SubscriptionTier;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
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
  canUpgradeToStandard: boolean;
  canUpgradeToPremium: boolean;
}

class SubscriptionService {
  /**
   * Get pricing information for all tiers
   */
  getPricingInfo(): PricingInfo[] {
    return [
      {
        tier: 'free',
        name: 'Free',
        priceMonthly: 0,
        priceYearly: 0,
        currency: 'GBP',
        features: [
          '1 household',
          'Up to 2 members',
          'Unlimited shifts & notes',
          'Smart shift patterns',
          'Two-week calendar view',
          'Household management',
          'Real-time sync',
        ],
      },
      {
        tier: 'standard',
        name: 'Standard',
        priceMonthly: 2.99,
        priceYearly: 29.99, // ~16% discount
        currency: 'GBP',
        features: [
          '1 household',
          'Up to 4 members',
          'Unlimited shifts & notes',
          'Smart shift patterns',
          'Two-week calendar view',
          'Enhanced household management',
          'Real-time sync',
          'Ad-free (when ads launch)',
        ],
      },
      {
        tier: 'premium',
        name: 'Premium',
        priceMonthly: 7.99,
        priceYearly: 79.99, // ~16% discount
        currency: 'GBP',
        features: [
          'Unlimited households',
          'Up to 12 members per household',
          'Unlimited shifts & notes',
          'Smart shift patterns',
          'Two-week calendar view',
          'Enterprise household management',
          'Real-time sync',
          'Ad-free (when ads launch)',
          'Calendar export',
          'Early access to new features',
        ],
      },
    ];
  }

  /**
   * Get subscription tier limits
   * 
   * IMPORTANT: For tier enforcement, prefer getEffectiveTier() which accounts
   * for canceled/expired subscriptions.
   */
  getTierLimits(tier: SubscriptionTier): SubscriptionLimits {
    switch (tier) {
      case 'premium':
        return {
          maxHouseholds: -1, // unlimited
          maxMembersPerHousehold: 12,
          showAdsToAdmin: false,
          showAdsToMembers: false,
          canUsePatterns: true,
          canUseTwoWeekView: true,
          canAddNotes: true,
          hasPrioritySupport: true,
          canExportCalendar: true,
          removesAdsForHousehold: true, // Premium removes ads for entire household
        };
      
      case 'standard':
        return {
          maxHouseholds: 1,
          maxMembersPerHousehold: 4,
          showAdsToAdmin: false,
          showAdsToMembers: true,
          canUsePatterns: true,
          canUseTwoWeekView: true,
          canAddNotes: true,
          hasPrioritySupport: false,
          canExportCalendar: false,
          removesAdsForHousehold: false, // Standard doesn't remove household ads
        };
      
      case 'free':
      default:
        return {
          maxHouseholds: 1,
          maxMembersPerHousehold: 2,
          showAdsToAdmin: true,
          showAdsToMembers: true,
          canUsePatterns: true,
          canUseTwoWeekView: true,
          canAddNotes: true,
          hasPrioritySupport: false,
          canExportCalendar: false,
          removesAdsForHousehold: false, // Free tier shows ads to everyone
        };
    }
  }

  /**
   * Get the effective tier for a subscription, accounting for status.
   * 
   * - 'active' or 'trialing' → use the stored tier
   * - 'canceled' → use the stored tier ONLY if still within currentPeriodEnd, else 'free'
   * - 'expired' → always 'free'
   */
  getEffectiveTier(subscription: Subscription): SubscriptionTier {
    if (subscription.status === 'expired') {
      return 'free';
    }

    if (subscription.status === 'canceled') {
      // Canceled subscriptions stay active until the end of the billing period
      const periodEnd = subscription.currentPeriodEnd instanceof Date
        ? subscription.currentPeriodEnd
        : new Date(subscription.currentPeriodEnd);
      if (new Date() > periodEnd) {
        return 'free';
      }
      // Still within the paid period
      return subscription.tier;
    }

    // 'active' or 'trialing'
    return subscription.tier;
  }

  /**
   * Get effective tier limits for a subscription (accounts for cancellation/expiry)
   */
  getEffectiveTierLimits(subscription: Subscription): SubscriptionLimits {
    return this.getTierLimits(this.getEffectiveTier(subscription));
  }

  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.SUBSCRIPTIONS),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        // Create default free subscription
        return this.createDefaultSubscription(userId);
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
      } as Subscription;
    } catch (error) {
      console.error('Failed to get user subscription:', error);
      // Return default free tier on error
      return {
        id: 'default',
        userId,
        tier: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Create default free subscription for new users
   */
  private async createDefaultSubscription(userId: string): Promise<Subscription> {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day trial
    const yearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subscription: Omit<Subscription, 'id'> = {
      userId,
      tier: 'free',
      status: 'trialing',
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: yearFromNow,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const docRef = await addDoc(
        collection(db, COLLECTIONS.SUBSCRIPTIONS),
        subscription
      );

      return {
        id: docRef.id,
        ...subscription,
      };
    } catch (error) {
      console.error('Failed to create default subscription:', error);
      // Return in-memory subscription if Firestore fails
      return {
        id: 'temp',
        ...subscription,
      };
    }
  }

  /**
   * Check if user can add a household
   */
  async canAddHousehold(userId: string): Promise<FeatureCheckResult> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return {allowed: false, reason: 'No subscription found'};
      }

      const effectiveTier = this.getEffectiveTier(subscription);
      const limits = this.getTierLimits(effectiveTier);
      
      // Pro tier has unlimited households
      if (limits.maxHouseholds === -1) {
        return {allowed: true};
      }

      // Count user's households
      const householdsQuery = query(
        collection(db, COLLECTIONS.HOUSEHOLDS),
        where('members', 'array-contains', userId)
      );
      const householdsSnapshot = await getDocs(householdsQuery);

      const currentCount = householdsSnapshot.size;

      if (currentCount >= limits.maxHouseholds) {
        return {
          allowed: false,
          reason: `${effectiveTier === 'free' ? 'Free' : effectiveTier} tier limited to ${limits.maxHouseholds} household`,
          currentUsage: currentCount,
          limit: limits.maxHouseholds,
        };
      }

      return {allowed: true, currentUsage: currentCount, limit: limits.maxHouseholds};
    } catch (error) {
      console.error('Failed to check household limit:', error);
      track('tier_check_fail_closed', { scope: 'households', error: String(error) }, 'warn');
      return {allowed: false, reason: 'Unable to verify subscription. Please try again.'};
    }
  }

  /**
   * Check if user can add a member to household
   */
  async canAddMember(userId: string, householdId: string): Promise<FeatureCheckResult> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return {allowed: false, reason: 'No subscription found'};
      }

      const effectiveTier = this.getEffectiveTier(subscription);
      const limits = this.getTierLimits(effectiveTier);
      
      // Pro tier has unlimited members
      if (limits.maxMembersPerHousehold === -1) {
        return {allowed: true};
      }

      // Get household member count
      const householdDocRef = doc(db, COLLECTIONS.HOUSEHOLDS, householdId);
      const householdDoc = await getDoc(householdDocRef);

      if (!householdDoc.exists) {
        return {allowed: false, reason: 'Household not found'};
      }

      const household = householdDoc.data();
      const currentCount = household?.members?.length || 0;

      if (currentCount >= limits.maxMembersPerHousehold) {
        return {
          allowed: false,
          reason: `Your plan is limited to ${limits.maxMembersPerHousehold} members per household`,
          currentUsage: currentCount,
          limit: limits.maxMembersPerHousehold,
        };
      }

      return {allowed: true, currentUsage: currentCount, limit: limits.maxMembersPerHousehold};
    } catch (error) {
      console.error('Failed to check member limit:', error);
      track('tier_check_fail_closed', { scope: 'members', householdId, error: String(error) }, 'warn');
      return {allowed: false, reason: 'Unable to verify subscription. Please try again.'};
    }
  }

  /**
   * Check if user's trial is active
   */
  isTrialActive(subscription: Subscription): boolean {
    if (subscription.status !== 'trialing' || !subscription.trialEndsAt) {
      return false;
    }
    return new Date() < subscription.trialEndsAt;
  }

  /**
   * Get days remaining in trial
   */
  getTrialDaysRemaining(subscription: Subscription): number {
    if (!this.isTrialActive(subscription)) {
      return 0;
    }
    
    const now = new Date();
    const trialEnd = subscription.trialEndsAt!;
    const msRemaining = trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
    
    return Math.max(0, daysRemaining);
  }

  /**
   * Upgrade/change user subscription tier
   * Note: User can only change their own subscription, or household admin can trigger for their household
   */
  async changeSubscriptionTier(
    userId: string,
    newTier: SubscriptionTier,
    paymentMethod?: string,
    householdId?: string
  ): Promise<Subscription> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      if (!currentSubscription) {
        throw new Error('No subscription found');
      }

      // If householdId provided, verify the requester is admin before allowing change
      if (householdId) {
        const adminCheck = await rbacService.enforceAdminOnly(householdId, userId, AuditAction.SUBSCRIPTION_UPGRADE);
        if (!adminCheck.allowed) {
          throw new Error(adminCheck.reason || 'Unauthorized to change subscription tier');
        }
      }

      const now = new Date();
      const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const updatedSubscription: Partial<Subscription> = {
        tier: newTier,
        status: 'active',
        trialEndsAt: undefined, // Clear trial when upgrading
        currentPeriodStart: now,
        currentPeriodEnd: monthFromNow,
        updatedAt: now,
      };

      await updateDoc(
        doc(db, COLLECTIONS.SUBSCRIPTIONS, currentSubscription.id),
        updatedSubscription
      );

      // Log subscription change to audit trail
      if (householdId) {
        const actionType = newTier === 'free' ? AuditAction.SUBSCRIPTION_CANCEL : AuditAction.SUBSCRIPTION_UPGRADE;
        await auditService.logHouseholdAction(householdId, userId, actionType, { tier: newTier });
      }

      return {
        ...currentSubscription,
        ...updatedSubscription,
      } as Subscription;
    } catch (error) {
      console.error('Failed to change subscription tier:', error);
      throw new Error('Failed to change subscription tier');
    }
  }

  /**
   * Upgrade to Standard tier (£2.99/mo)
   */
  async upgradeToStandard(userId: string, paymentMethod?: string): Promise<Subscription> {
    return this.changeSubscriptionTier(userId, 'standard', paymentMethod);
  }

  /**
   * Upgrade to Premium tier (£7.99/mo)
   */
  async upgradeToPremium(userId: string, paymentMethod?: string): Promise<Subscription> {
    return this.changeSubscriptionTier(userId, 'premium', paymentMethod);
  }

  /**
   * Downgrade to Free tier
   */
  async downgradeToFree(userId: string): Promise<Subscription> {
    return this.changeSubscriptionTier(userId, 'free');
  }

  /**
   * Cancel subscription (mark for end of period)
   * Only the subscription owner can cancel their own subscription
   */
  async cancelSubscription(userId: string, householdId?: string): Promise<Subscription> {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      if (!currentSubscription) {
        throw new Error('No subscription found');
      }

      // If householdId provided, verify the requester is admin
      if (householdId) {
        const adminCheck = await rbacService.enforceAdminOnly(householdId, userId, AuditAction.SUBSCRIPTION_CANCEL);
        if (!adminCheck.allowed) {
          throw new Error(adminCheck.reason || 'Unauthorized to cancel subscription');
        }
      }

      const now = new Date();

      const updatedSubscription: Partial<Subscription> = {
        status: 'canceled',
        canceledAt: now,
        updatedAt: now,
      };

      await updateDoc(
        doc(db, COLLECTIONS.SUBSCRIPTIONS, currentSubscription.id),
        updatedSubscription
      );

      // Log subscription cancellation
      if (householdId) {
        await auditService.logHouseholdAction(householdId, userId, AuditAction.SUBSCRIPTION_CANCEL, { cancelled: true });
      }

      // Trigger downgrade workflow asynchronously
      // This notifies all household members about potential downgrades
      (async () => {
        try {
          await this.processSubscriptionDowngrade(userId, currentSubscription.tier);
        } catch (error) {
          console.warn('⚠️ Failed to process downgrade workflow:', error);
          // Don't throw - subscription cancellation should not fail if workflow has issues
        }
      })();

      return {
        ...currentSubscription,
        ...updatedSubscription,
      } as Subscription;
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  /**
   * Process household downgrades when subscription is canceled
   * Downgrades user's households from current tier to free tier with 7-day grace period
   */
  private async processSubscriptionDowngrade(userId: string, previousTier: string): Promise<void> {
    try {
      // Find all households where this user is admin
      const householdsQuery = query(
        collection(db, COLLECTIONS.HOUSEHOLDS),
        where('admins', 'array-contains', userId)
      );
      
      const householdsSnapshot = await getDocs(householdsQuery);
      
      if (householdsSnapshot.empty) {
        return;
      }

      const affectedHouseholds: Array<{name: string; memberCount: number; tierLimit: number}> = [];
      
      for (const householdDoc of householdsSnapshot.docs) {
        const household = householdDoc.data();
        
        // Downgrade household from current tier to free tier (2 members max)
        const freeTierLimits = this.getTierLimits('free');
        const excessMembers = Math.max(0, household.members.length - freeTierLimits.maxMembersPerHousehold);
        
        // Update household with downgrade info
        await updateDoc(doc(db, COLLECTIONS.HOUSEHOLDS, householdDoc.id), {
          subscribedTier: 'free',
          tierSyncedAt: new Date(),
          downgradeWarningAt: excessMembers > 0 ? new Date() : undefined,
          updatedAt: new Date(),
        });

        if (excessMembers > 0) {
          affectedHouseholds.push({
            name: household.name,
            memberCount: household.members.length,
            tierLimit: freeTierLimits.maxMembersPerHousehold,
          });

          // Notify all household members about the downgrade
          try {
            const memberIds = household.members.map(m => m.userId);
            await notificationService.notifyHouseholdDowngrade(
              householdDoc.id,
              memberIds,
              previousTier,
              'free'
            );
          } catch (notificationError) {
            console.warn(`⚠️ Failed to notify household members:`, notificationError);
          }
        }
      }

      // Notify admin of all affected households
      if (affectedHouseholds.length > 0) {
        try {
          await notificationService.notifySubscriptionCanceled(userId, affectedHouseholds);
        } catch (notificationError) {
          console.warn(`⚠️ Failed to notify admin of cancellation:`, notificationError);
        }
      }

    } catch (error: any) {
      console.error('Error processing subscription downgrade:', error);
      throw error;
    }
  }

  /**
   * Get formatted subscription info for display
   */
  getSubscriptionDisplayInfo(subscription: Subscription): SubscriptionDisplayInfo {
    const isTrial = this.isTrialActive(subscription);
    const trialDays = this.getTrialDaysRemaining(subscription);

    let statusText = '';
    let statusColor = '#10B981'; // green

    if (isTrial) {
      statusText = `Trial: ${trialDays} days left`;
      statusColor = '#F59E0B'; // orange
    } else if (subscription.status === 'active') {
      statusText = 'Active';
    } else if (subscription.status === 'canceled') {
      statusText = 'Canceled';
      statusColor = '#EF4444'; // red
    } else if (subscription.status === 'expired') {
      statusText = 'Expired';
      statusColor = '#EF4444'; // red
    }

    let tierName = 'Free';
    let tierBadgeColor = '#6B7280'; // gray
    let benefits: string[] = [];

    switch (subscription.tier) {
      case 'premium':
        tierName = 'Premium';
        tierBadgeColor = '#F59E0B'; // gold
        benefits = [
          'Unlimited households',
          'Up to 12 members per household',
          'Ad-free (when ads launch)',
          'Priority support',
          'Calendar export',
        ];
        break;
      
      case 'standard':
        tierName = 'Standard';
        tierBadgeColor = '#6366F1'; // purple
        benefits = [
          '1 household',
          'Up to 4 members',
          'Ad-free (when ads launch)',
          'All features',
        ];
        break;
      
      case 'free':
      default:
        tierName = 'Free';
        tierBadgeColor = '#6B7280'; // gray
        benefits = [
          '1 household',
          'Up to 2 members',
          'Unlimited shifts & notes',
          'Banner ads (coming soon)',
        ];
        break;
    }

    return {
      tierName,
      tierBadgeColor,
      statusText,
      statusColor,
      benefits,
      showUpgrade: this.getEffectiveTier(subscription) !== 'premium',
      canUpgradeToStandard: this.getEffectiveTier(subscription) === 'free',
      canUpgradeToPremium: this.getEffectiveTier(subscription) === 'free' || this.getEffectiveTier(subscription) === 'standard',
    };
  }

  /**
   * Check if user should see ads (based on their role and effective tier)
   */
  shouldShowAds(subscription: Subscription, isAdmin: boolean): boolean {
    const effectiveTier = this.getEffectiveTier(subscription);
    const limits = this.getTierLimits(effectiveTier);
    
    if (isAdmin) {
      return limits.showAdsToAdmin;
    } else {
      return limits.showAdsToMembers;
    }
  }

  /**
   * Check if user should see ads in a household context
   * Premium admin removes ads for entire household
   * 
   * Rules:
   * - If current user's effective tier is Premium → no ads
   * - If household admin's effective tier is Premium → no ads (household perk)
   * - Otherwise → check based on user's own tier and role
   */
  shouldShowAdsInHousehold(
    userSubscription: Subscription,
    adminSubscription: Subscription,
    isCurrentUserAdmin: boolean
  ): boolean {
    // If user is effectively Premium, they don't see ads
    if (this.getEffectiveTier(userSubscription) === 'premium') {
      return false;
    }

    // If household admin is effectively Premium, nobody in household sees ads
    if (this.getEffectiveTier(adminSubscription) === 'premium') {
      return false;
    }

    // Otherwise, check based on user's own tier and role
    return this.shouldShowAds(userSubscription, isCurrentUserAdmin);
  }
}

export const subscriptionService = new SubscriptionService();
