/**
 * Integration tests — Subscription Flow
 *
 * Tests the full subscription lifecycle from Free → Standard → Premium,
 * including tier limit enforcement, feature gating, and ad visibility.
 */

import { subscriptionService, SubscriptionTier, Subscription } from '@/services/subscription.service';

// Helper to create a Subscription object
const makeSub = (
  tier: SubscriptionTier,
  status: 'active' | 'trialing' | 'expired' | 'canceled' = 'active',
  overrides: Partial<Subscription> = {},
): Subscription => ({
  id: 'sub-1',
  userId: 'user-1',
  tier,
  status,
  currentPeriodStart: new Date('2026-01-01'),
  currentPeriodEnd: new Date('2026-02-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('Subscription Flow Integration', () => {
  // ── Full lifecycle ─────────────────────────────────────────────────
  describe('Free → Standard → Premium lifecycle', () => {
    it('free user gets free limits', () => {
      const limits = subscriptionService.getTierLimits('free');
      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(2);
      expect(limits.showAdsToAdmin).toBe(true);
      expect(limits.showAdsToMembers).toBe(true);
      expect(limits.canExportCalendar).toBe(false);
    });

    it('standard user gets standard limits', () => {
      const limits = subscriptionService.getTierLimits('standard');
      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(4);
      expect(limits.showAdsToAdmin).toBe(false);
      expect(limits.showAdsToMembers).toBe(true);
      expect(limits.canExportCalendar).toBe(false);
    });

    it('premium user gets premium limits', () => {
      const limits = subscriptionService.getTierLimits('premium');
      expect(limits.maxHouseholds).toBe(-1); // unlimited
      expect(limits.maxMembersPerHousehold).toBe(12);
      expect(limits.showAdsToAdmin).toBe(false);
      expect(limits.showAdsToMembers).toBe(false);
      expect(limits.canExportCalendar).toBe(true);
      expect(limits.hasPrioritySupport).toBe(true);
    });
  });

  // ── Effective tier after subscription changes ─────────────────────
  describe('subscription status transitions', () => {
    it('active subscription uses stored tier', () => {
      const sub = makeSub('premium', 'active');
      expect(subscriptionService.getEffectiveTier(sub)).toBe('premium');
    });

    it('trialing subscription uses stored tier', () => {
      const sub = makeSub('standard', 'trialing');
      expect(subscriptionService.getEffectiveTier(sub)).toBe('standard');
    });

    it('expired subscription falls back to free', () => {
      const sub = makeSub('premium', 'expired');
      expect(subscriptionService.getEffectiveTier(sub)).toBe('free');
    });

    it('canceled subscription within billing period keeps tier', () => {
      const sub = makeSub('standard', 'canceled', {
        currentPeriodEnd: new Date(Date.now() + 86400000), // tomorrow
      });
      expect(subscriptionService.getEffectiveTier(sub)).toBe('standard');
    });

    it('canceled subscription past billing period falls to free', () => {
      const sub = makeSub('premium', 'canceled', {
        currentPeriodEnd: new Date(Date.now() - 86400000), // yesterday
      });
      expect(subscriptionService.getEffectiveTier(sub)).toBe('free');
    });
  });

  // ── Ad visibility across subscription states ──────────────────────
  describe('ad visibility across tiers and roles', () => {
    it('free admin sees ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('free'), true)).toBe(true);
    });

    it('free member sees ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('free'), false)).toBe(true);
    });

    it('standard admin does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('standard'), true)).toBe(false);
    });

    it('standard member DOES see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('standard'), false)).toBe(true);
    });

    it('premium admin does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('premium'), true)).toBe(false);
    });

    it('premium member does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds(makeSub('premium'), false)).toBe(false);
    });

    it('expired premium user sees ads (effective tier = free)', () => {
      const sub = makeSub('premium', 'expired');
      const effectiveTier = subscriptionService.getEffectiveTier(sub);
      const effectiveSub = { ...sub, tier: effectiveTier };
      expect(subscriptionService.shouldShowAds(effectiveSub, true)).toBe(true);
    });
  });

  // ── Household-aware ad logic ──────────────────────────────────────
  describe('household-aware ad visibility', () => {
    it('premium admin removes ads for entire household', () => {
      const freeUser = makeSub('free');
      const premiumAdmin = makeSub('premium');
      
      // Non-admin free user in premium admin's household = no ads
      expect(
        subscriptionService.shouldShowAdsInHousehold(freeUser, premiumAdmin, false),
      ).toBe(false);
    });

    it('standard admin household members still see ads', () => {
      const freeUser = makeSub('free');
      const standardAdmin = makeSub('standard');
      
      expect(
        subscriptionService.shouldShowAdsInHousehold(freeUser, standardAdmin, false),
      ).toBe(true);
    });
  });

  // ── Feature gating ────────────────────────────────────────────────
  describe('feature gating consistency', () => {
    it('all tiers can use patterns', () => {
      expect(subscriptionService.getTierLimits('free').canUsePatterns).toBe(true);
      expect(subscriptionService.getTierLimits('standard').canUsePatterns).toBe(true);
      expect(subscriptionService.getTierLimits('premium').canUsePatterns).toBe(true);
    });

    it('all tiers can use two-week view', () => {
      expect(subscriptionService.getTierLimits('free').canUseTwoWeekView).toBe(true);
      expect(subscriptionService.getTierLimits('standard').canUseTwoWeekView).toBe(true);
      expect(subscriptionService.getTierLimits('premium').canUseTwoWeekView).toBe(true);
    });

    it('only premium can export calendar', () => {
      expect(subscriptionService.getTierLimits('free').canExportCalendar).toBe(false);
      expect(subscriptionService.getTierLimits('standard').canExportCalendar).toBe(false);
      expect(subscriptionService.getTierLimits('premium').canExportCalendar).toBe(true);
    });

    it('only premium has priority support', () => {
      expect(subscriptionService.getTierLimits('free').hasPrioritySupport).toBe(false);
      expect(subscriptionService.getTierLimits('standard').hasPrioritySupport).toBe(false);
      expect(subscriptionService.getTierLimits('premium').hasPrioritySupport).toBe(true);
    });
  });

  // ── Pricing consistency ───────────────────────────────────────────
  describe('pricing information', () => {
    const pricing = subscriptionService.getPricingInfo();

    it('returns exactly 3 tiers', () => {
      expect(pricing).toHaveLength(3);
    });

    it('free tier has zero price', () => {
      const free = pricing.find(p => p.tier === 'free')!;
      expect(free.priceMonthly).toBe(0);
      expect(free.priceYearly).toBe(0);
    });

    it('standard yearly is cheaper per month than monthly', () => {
      const standard = pricing.find(p => p.tier === 'standard')!;
      const yearlyPerMonth = standard.priceYearly / 12;
      expect(yearlyPerMonth).toBeLessThan(standard.priceMonthly);
    });

    it('premium yearly is cheaper per month than monthly', () => {
      const premium = pricing.find(p => p.tier === 'premium')!;
      const yearlyPerMonth = premium.priceYearly / 12;
      expect(yearlyPerMonth).toBeLessThan(premium.priceMonthly);
    });

    it('premium is more expensive than standard', () => {
      const standard = pricing.find(p => p.tier === 'standard')!;
      const premium = pricing.find(p => p.tier === 'premium')!;
      expect(premium.priceMonthly).toBeGreaterThan(standard.priceMonthly);
    });

    it('all tiers use GBP currency', () => {
      pricing.forEach(plan => {
        expect(plan.currency).toBe('GBP');
      });
    });

    it('all tiers have features listed', () => {
      pricing.forEach(plan => {
        expect(plan.features.length).toBeGreaterThan(0);
      });
    });
  });

  // ── Display info ──────────────────────────────────────────────────
  describe('subscription display info', () => {
    it('free user can upgrade to standard and premium', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo(makeSub('free'));
      expect(info.showUpgrade).toBe(true);
      expect(info.canUpgradeToStandard).toBe(true);
      expect(info.canUpgradeToPremium).toBe(true);
    });

    it('standard user can only upgrade to premium', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo(makeSub('standard'));
      expect(info.canUpgradeToStandard).toBe(false);
      expect(info.canUpgradeToPremium).toBe(true);
    });

    it('premium user cannot upgrade further', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo(makeSub('premium'));
      expect(info.showUpgrade).toBe(false);
    });
  });
});
