/**
 * Unit tests for subscription service — pure logic (no Firestore)
 */
import { subscriptionService } from '@/services/subscription.service';
import type { Subscription, SubscriptionTier } from '@/services/subscription.service';

describe('SubscriptionService', () => {
  // ── Pricing ────────────────────────────────────────────────────────────────
  describe('getPricingInfo', () => {
    it('returns all 3 tiers', () => {
      const pricing = subscriptionService.getPricingInfo();
      expect(pricing).toHaveLength(3);
      expect(pricing.map(p => p.tier)).toEqual(['free', 'standard', 'premium']);
    });

    it('free tier has price 0', () => {
      const free = subscriptionService.getPricingInfo().find(p => p.tier === 'free')!;
      expect(free.priceMonthly).toBe(0);
      expect(free.priceYearly).toBe(0);
    });

    it('standard tier is £2.99/mo, £29.99/yr', () => {
      const std = subscriptionService.getPricingInfo().find(p => p.tier === 'standard')!;
      expect(std.priceMonthly).toBe(2.99);
      expect(std.priceYearly).toBe(29.99);
      expect(std.currency).toBe('GBP');
    });

    it('premium tier is £7.99/mo, £79.99/yr', () => {
      const prem = subscriptionService.getPricingInfo().find(p => p.tier === 'premium')!;
      expect(prem.priceMonthly).toBe(7.99);
      expect(prem.priceYearly).toBe(79.99);
    });

    it('yearly price provides discount vs monthly', () => {
      for (const info of subscriptionService.getPricingInfo()) {
        if (info.priceMonthly > 0) {
          expect(info.priceYearly).toBeLessThan(info.priceMonthly * 12);
        }
      }
    });
  });

  // ── Tier Limits ────────────────────────────────────────────────────────────
  describe('getTierLimits', () => {
    it('free tier limits: 1 household, 2 members, ads on', () => {
      const limits = subscriptionService.getTierLimits('free');
      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(2);
      expect(limits.showAdsToAdmin).toBe(true);
      expect(limits.showAdsToMembers).toBe(true);
      expect(limits.canExportCalendar).toBe(false);
    });

    it('standard tier limits: 1 household, 4 members, admin ad-free', () => {
      const limits = subscriptionService.getTierLimits('standard');
      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(4);
      expect(limits.showAdsToAdmin).toBe(false);
      expect(limits.showAdsToMembers).toBe(true);
      expect(limits.canExportCalendar).toBe(false);
    });

    it('premium tier limits: unlimited households, 12 members, no ads, export', () => {
      const limits = subscriptionService.getTierLimits('premium');
      expect(limits.maxHouseholds).toBe(-1);
      expect(limits.maxMembersPerHousehold).toBe(12);
      expect(limits.showAdsToAdmin).toBe(false);
      expect(limits.showAdsToMembers).toBe(false);
      expect(limits.canExportCalendar).toBe(true);
      expect(limits.hasPrioritySupport).toBe(true);
    });

    it('all tiers grant patterns and two-week view', () => {
      const tiers: SubscriptionTier[] = ['free', 'standard', 'premium'];
      for (const tier of tiers) {
        const limits = subscriptionService.getTierLimits(tier);
        expect(limits.canUsePatterns).toBe(true);
        expect(limits.canUseTwoWeekView).toBe(true);
        expect(limits.canAddNotes).toBe(true);
      }
    });
  });

  // ── Effective Tier ─────────────────────────────────────────────────────────
  describe('getEffectiveTier', () => {
    const baseSub: Subscription = {
      id: 'sub-1',
      userId: 'user-1',
      tier: 'premium',
      status: 'active',
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('returns stored tier for active subscriptions', () => {
      expect(subscriptionService.getEffectiveTier({ ...baseSub, status: 'active' })).toBe('premium');
    });

    it('returns stored tier for trialing subscriptions', () => {
      expect(subscriptionService.getEffectiveTier({ ...baseSub, status: 'trialing' })).toBe('premium');
    });

    it('returns free for expired subscriptions', () => {
      expect(subscriptionService.getEffectiveTier({ ...baseSub, status: 'expired' })).toBe('free');
    });

    it('returns stored tier for canceled subscription still within billing period', () => {
      const sub: Subscription = {
        ...baseSub,
        status: 'canceled',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      };
      expect(subscriptionService.getEffectiveTier(sub)).toBe('premium');
    });

    it('returns free for canceled subscription past billing period', () => {
      const sub: Subscription = {
        ...baseSub,
        status: 'canceled',
        currentPeriodEnd: new Date('2020-01-01'), // long ago
      };
      expect(subscriptionService.getEffectiveTier(sub)).toBe('free');
    });
  });

  // ── Effective Tier Limits ──────────────────────────────────────────────────
  describe('getEffectiveTierLimits', () => {
    it('expired premium gets free limits', () => {
      const sub: Subscription = {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'premium',
        status: 'expired',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const limits = subscriptionService.getEffectiveTierLimits(sub);
      expect(limits.maxMembersPerHousehold).toBe(2); // free tier
    });
  });

  // ── Trial ──────────────────────────────────────────────────────────────
  describe('isTrialActive', () => {
    const now = new Date();

    it('returns true for trialing status with future end date', () => {
      const sub: Subscription = {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'free',
        status: 'trialing',
        trialEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      };
      expect(subscriptionService.isTrialActive(sub)).toBe(true);
    });

    it('returns false for expired trial', () => {
      const sub: Subscription = {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'free',
        status: 'trialing',
        trialEndsAt: new Date('2020-01-01'),
        currentPeriodStart: now,
        currentPeriodEnd: now,
        createdAt: now,
        updatedAt: now,
      };
      expect(subscriptionService.isTrialActive(sub)).toBe(false);
    });

    it('returns false for active (non-trial) subscription', () => {
      const sub: Subscription = {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'standard',
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      };
      expect(subscriptionService.isTrialActive(sub)).toBe(false);
    });
  });

  describe('getTrialDaysRemaining', () => {
    it('returns positive days for active trial', () => {
      const now = new Date();
      const sub: Subscription = {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'free',
        status: 'trialing',
        trialEndsAt: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      };
      const days = subscriptionService.getTrialDaysRemaining(sub);
      expect(days).toBeGreaterThanOrEqual(9);
      expect(days).toBeLessThanOrEqual(11);
    });

    it('returns 0 for expired trial', () => {
      const sub: Subscription = {
        id: 'sub-1',
        userId: 'user-1',
        tier: 'free',
        status: 'trialing',
        trialEndsAt: new Date('2020-01-01'),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(subscriptionService.getTrialDaysRemaining(sub)).toBe(0);
    });
  });

  // ── shouldShowAds ──────────────────────────────────────────────────────
  describe('shouldShowAds', () => {
    const makeSub = (tier: SubscriptionTier): Subscription => ({
      id: 'sub-1',
      userId: 'user-1',
      tier,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('free admin sees ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('free'), true)).toBe(true);
    });

    it('free member sees ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('free'), false)).toBe(true);
    });

    it('standard admin does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('standard'), true)).toBe(false);
    });

    it('standard member sees ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('standard'), false)).toBe(true);
    });

    it('premium admin does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('premium'), true)).toBe(false);
    });

    it('premium member does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('premium'), false)).toBe(false);
    });
  });

  // ── shouldShowAdsInHousehold ───────────────────────────────────────────
  describe('shouldShowAdsInHousehold', () => {
    const makeSub = (tier: SubscriptionTier): Subscription => ({
      id: 'sub-1',
      userId: 'user-1',
      tier,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('premium user never sees ads regardless of admin tier', () => {
      expect(subscriptionService.shouldShowAdsInHousehold(makeSub('premium'), makeSub('free'), false)).toBe(false);
    });

    it('premium admin removes ads for entire household', () => {
      expect(subscriptionService.shouldShowAdsInHousehold(makeSub('free'), makeSub('premium'), false)).toBe(false);
    });

    it('standard admin + free member → member sees ads', () => {
      expect(subscriptionService.shouldShowAdsInHousehold(makeSub('free'), makeSub('standard'), false)).toBe(true);
    });

    it('free admin sees ads when admin is also free', () => {
      expect(subscriptionService.shouldShowAdsInHousehold(makeSub('free'), makeSub('free'), true)).toBe(true);
    });
  });

  // ── getSubscriptionDisplayInfo ─────────────────────────────────────────
  describe('getSubscriptionDisplayInfo', () => {
    it('active premium shows correct display', () => {
      const sub: Subscription = {
        id: 's1',
        userId: 'u1',
        tier: 'premium',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const info = subscriptionService.getSubscriptionDisplayInfo(sub);
      expect(info.tierName).toBe('Premium');
      expect(info.statusText).toBe('Active');
      expect(info.showUpgrade).toBe(false);
      expect(info.canUpgradeToPremium).toBe(false);
    });

    it('free tier shows upgrade options', () => {
      const sub: Subscription = {
        id: 's1',
        userId: 'u1',
        tier: 'free',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const info = subscriptionService.getSubscriptionDisplayInfo(sub);
      expect(info.tierName).toBe('Free');
      expect(info.showUpgrade).toBe(true);
      expect(info.canUpgradeToStandard).toBe(true);
      expect(info.canUpgradeToPremium).toBe(true);
    });

    it('canceled subscription shows canceled status in red', () => {
      const sub: Subscription = {
        id: 's1',
        userId: 'u1',
        tier: 'standard',
        status: 'canceled',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date('2020-01-01'),
        canceledAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const info = subscriptionService.getSubscriptionDisplayInfo(sub);
      expect(info.statusText).toBe('Canceled');
      expect(info.statusColor).toBe('#EF4444');
    });
  });
});
