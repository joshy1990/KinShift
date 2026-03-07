/**
 * Integration tests — Subscription Flow
 *
 * Tests the 2-tier subscription lifecycle (Free / Pro),
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
  // ── Tier limits ────────────────────────────────────────────────────
  describe('Free / Pro tier limits', () => {
    it('free user gets free limits', () => {
      const limits = subscriptionService.getTierLimits('free');
      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(2);
      expect(limits.showAds).toBe(true);
      expect(limits.canExportCalendar).toBe(false);
    });

    it('pro user gets pro limits', () => {
      const limits = subscriptionService.getTierLimits('pro');
      expect(limits.maxHouseholds).toBe(-1); // unlimited
      expect(limits.maxMembersPerHousehold).toBe(12);
      expect(limits.showAds).toBe(false);
      expect(limits.canExportCalendar).toBe(true);
    });
  });

  // ── Effective tier after subscription changes ─────────────────────
  describe('subscription status transitions', () => {
    it('active subscription uses stored tier', () => {
      const sub = makeSub('pro', 'active');
      expect(subscriptionService.getEffectiveTier(sub)).toBe('pro');
    });

    it('trialing subscription uses stored tier', () => {
      const sub = makeSub('pro', 'trialing');
      expect(subscriptionService.getEffectiveTier(sub)).toBe('pro');
    });

    it('expired subscription falls back to free', () => {
      const sub = makeSub('pro', 'expired');
      expect(subscriptionService.getEffectiveTier(sub)).toBe('free');
    });

    it('canceled subscription within billing period keeps tier', () => {
      const sub = makeSub('pro', 'canceled', {
        currentPeriodEnd: new Date(Date.now() + 86400000), // tomorrow
      });
      expect(subscriptionService.getEffectiveTier(sub)).toBe('pro');
    });

    it('canceled subscription past billing period falls to free', () => {
      const sub = makeSub('pro', 'canceled', {
        currentPeriodEnd: new Date(Date.now() - 86400000), // yesterday
      });
      expect(subscriptionService.getEffectiveTier(sub)).toBe('free');
    });
  });

  // ── Ad visibility ─────────────────────────────────────────────────
  describe('ad visibility across tiers', () => {
    it('free user sees ads', () => {
      expect(subscriptionService.shouldShowAds('free')).toBe(true);
    });

    it('pro user does NOT see ads', () => {
      expect(subscriptionService.shouldShowAds('pro')).toBe(false);
    });

    it('expired pro user sees ads (effective tier = free)', () => {
      const sub = makeSub('pro', 'expired');
      const effectiveTier = subscriptionService.getEffectiveTier(sub);
      expect(subscriptionService.shouldShowAds(effectiveTier)).toBe(true);
    });
  });

  // ── Feature gating ────────────────────────────────────────────────
  describe('feature gating consistency', () => {
    it('all tiers can use patterns', () => {
      expect(subscriptionService.getTierLimits('free').canUsePatterns).toBe(true);
      expect(subscriptionService.getTierLimits('pro').canUsePatterns).toBe(true);
    });

    it('all tiers can use two-week view', () => {
      expect(subscriptionService.getTierLimits('free').canUseTwoWeekView).toBe(true);
      expect(subscriptionService.getTierLimits('pro').canUseTwoWeekView).toBe(true);
    });

    it('only pro can export calendar', () => {
      expect(subscriptionService.getTierLimits('free').canExportCalendar).toBe(false);
      expect(subscriptionService.getTierLimits('pro').canExportCalendar).toBe(true);
    });
  });

  // ── Display info ──────────────────────────────────────────────────
  describe('subscription display info', () => {
    it('free user shows upgrade option', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo(makeSub('free'));
      expect(info.showUpgrade).toBe(true);
      expect(info.tierName).toBe('Free');
    });

    it('pro user does NOT show upgrade option', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo(makeSub('pro'));
      expect(info.showUpgrade).toBe(false);
      expect(info.tierName).toBe('Pro');
    });
  });
});
