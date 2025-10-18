import {subscriptionService} from '../subscription.service';
import {SubscriptionTier} from '../subscription.service';
import firestore from '@react-native-firebase/firestore';

// Mock Firestore
jest.mock('@react-native-firebase/firestore', () => {
  const mockCollection = jest.fn();
  const mockDoc = jest.fn();
  const mockGet = jest.fn();
  const mockAdd = jest.fn();
  const mockUpdate = jest.fn();
  const mockWhere = jest.fn();
  const mockOrderBy = jest.fn();
  const mockLimit = jest.fn();

  const createMockQuery = () => ({
    where: mockWhere.mockReturnThis(),
    orderBy: mockOrderBy.mockReturnThis(),
    limit: mockLimit.mockReturnThis(),
    get: mockGet,
  });

  mockCollection.mockImplementation(() => createMockQuery());
  mockDoc.mockReturnValue({
    get: mockGet,
    update: mockUpdate,
  });

  return () => ({
    collection: mockCollection,
    doc: mockDoc,
  });
});

describe('Subscription Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPricingInfo', () => {
    it('should return all three pricing tiers', () => {
      const pricing = subscriptionService.getPricingInfo();

      expect(pricing).toHaveLength(3);
      expect(pricing.map(p => p.tier)).toEqual(['free', 'standard', 'premium']);
    });

    it('should have correct pricing for each tier', () => {
      const pricing = subscriptionService.getPricingInfo();

      const free = pricing.find(p => p.tier === 'free');
      expect(free?.priceMonthly).toBe(0);
      expect(free?.priceYearly).toBe(0);

      const standard = pricing.find(p => p.tier === 'standard');
      expect(standard?.priceMonthly).toBe(2.99);
      expect(standard?.priceYearly).toBe(29.99);

      const premium = pricing.find(p => p.tier === 'premium');
      expect(premium?.priceMonthly).toBe(7.99);
      expect(premium?.priceYearly).toBe(79.99);
    });

    it('should use GBP currency for all tiers', () => {
      const pricing = subscriptionService.getPricingInfo();

      pricing.forEach(tier => {
        expect(tier.currency).toBe('GBP');
      });
    });
  });

  describe('getTierLimits', () => {
    it('should return correct limits for free tier', () => {
      const limits = subscriptionService.getTierLimits('free');

      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(2);
      expect(limits.showAdsToAdmin).toBe(true);
      expect(limits.showAdsToMembers).toBe(true);
      expect(limits.canUsePatterns).toBe(true);
      expect(limits.hasPrioritySupport).toBe(false);
    });

    it('should return correct limits for standard tier', () => {
      const limits = subscriptionService.getTierLimits('standard');

      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(4);
      expect(limits.showAdsToAdmin).toBe(false);
      expect(limits.showAdsToMembers).toBe(true); // Members still see ads
      expect(limits.canUsePatterns).toBe(true);
      expect(limits.hasPrioritySupport).toBe(false);
    });

    it('should return correct limits for premium tier', () => {
      const limits = subscriptionService.getTierLimits('premium');

      expect(limits.maxHouseholds).toBe(-1); // unlimited
      expect(limits.maxMembersPerHousehold).toBe(12);
      expect(limits.showAdsToAdmin).toBe(false);
      expect(limits.showAdsToMembers).toBe(false);
      expect(limits.canUsePatterns).toBe(true);
      expect(limits.hasPrioritySupport).toBe(true);
      expect(limits.canExportCalendar).toBe(true);
    });
  });

  describe('shouldShowAds', () => {
    it('should show ads to free tier admin', () => {
      const subscription: any = {tier: 'free'};
      expect(subscriptionService.shouldShowAds(subscription, true)).toBe(true);
    });

    it('should show ads to free tier members', () => {
      const subscription: any = {tier: 'free'};
      expect(subscriptionService.shouldShowAds(subscription, false)).toBe(true);
    });

    it('should NOT show ads to standard tier admin', () => {
      const subscription: any = {tier: 'standard'};
      expect(subscriptionService.shouldShowAds(subscription, true)).toBe(false);
    });

    it('should show ads to standard tier members', () => {
      const subscription: any = {tier: 'standard'};
      expect(subscriptionService.shouldShowAds(subscription, false)).toBe(true);
    });

    it('should NOT show ads to premium tier admin', () => {
      const subscription: any = {tier: 'premium'};
      expect(subscriptionService.shouldShowAds(subscription, true)).toBe(false);
    });

    it('should NOT show ads to premium tier members', () => {
      const subscription: any = {tier: 'premium'};
      expect(subscriptionService.shouldShowAds(subscription, false)).toBe(false);
    });
  });

  describe('getSubscriptionDisplayInfo', () => {
    it('should return correct display info for free tier', () => {
      const subscription: any = {
        tier: 'free',
        status: 'active',
      };

      const info = subscriptionService.getSubscriptionDisplayInfo(subscription);

      expect(info.tierName).toBe('Free');
      expect(info.tierBadgeColor).toBe('#6B7280');
      expect(info.showUpgrade).toBe(true);
      expect(info.canUpgradeToStandard).toBe(true);
      expect(info.canUpgradeToPremium).toBe(true);
      expect(info.benefits).toContain('Up to 2 members');
    });

    it('should return correct display info for standard tier', () => {
      const subscription: any = {
        tier: 'standard',
        status: 'active',
      };

      const info = subscriptionService.getSubscriptionDisplayInfo(subscription);

      expect(info.tierName).toBe('Standard');
      expect(info.tierBadgeColor).toBe('#6366F1');
      expect(info.showUpgrade).toBe(true);
      expect(info.canUpgradeToStandard).toBe(false);
      expect(info.canUpgradeToPremium).toBe(true);
      expect(info.benefits).toContain('Up to 4 members');
    });

    it('should return correct display info for premium tier', () => {
      const subscription: any = {
        tier: 'premium',
        status: 'active',
      };

      const info = subscriptionService.getSubscriptionDisplayInfo(subscription);

      expect(info.tierName).toBe('Premium');
      expect(info.tierBadgeColor).toBe('#F59E0B');
      expect(info.showUpgrade).toBe(false);
      expect(info.canUpgradeToStandard).toBe(false);
      expect(info.canUpgradeToPremium).toBe(false);
      expect(info.benefits).toContain('Unlimited households');
      expect(info.benefits).toContain('Priority support');
    });

    it('should show trial status when trial is active', () => {
      const subscription: any = {
        tier: 'free',
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      };

      const info = subscriptionService.getSubscriptionDisplayInfo(subscription);

      expect(info.statusText).toContain('Trial');
      expect(info.statusText).toContain('5 days');
      expect(info.statusColor).toBe('#F59E0B'); // orange
    });

    it('should show canceled status', () => {
      const subscription: any = {
        tier: 'standard',
        status: 'canceled',
        canceledAt: new Date(),
      };

      const info = subscriptionService.getSubscriptionDisplayInfo(subscription);

      expect(info.statusText).toBe('Canceled');
      expect(info.statusColor).toBe('#EF4444'); // red
    });
  });

  describe('isTrialActive', () => {
    it('should return true if trial is active', () => {
      const subscription: any = {
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      expect(subscriptionService.isTrialActive(subscription)).toBe(true);
    });

    it('should return false if trial has expired', () => {
      const subscription: any = {
        status: 'trialing',
        trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      };

      expect(subscriptionService.isTrialActive(subscription)).toBe(false);
    });

    it('should return false if status is not trialing', () => {
      const subscription: any = {
        status: 'active',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      expect(subscriptionService.isTrialActive(subscription)).toBe(false);
    });

    it('should return false if trialEndsAt is missing', () => {
      const subscription: any = {
        status: 'trialing',
      };

      expect(subscriptionService.isTrialActive(subscription)).toBe(false);
    });
  });

  describe('getTrialDaysRemaining', () => {
    it('should return correct days remaining', () => {
      const subscription: any = {
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      };

      const days = subscriptionService.getTrialDaysRemaining(subscription);

      expect(days).toBeGreaterThanOrEqual(9);
      expect(days).toBeLessThanOrEqual(10);
    });

    it('should return 0 if trial has expired', () => {
      const subscription: any = {
        status: 'trialing',
        trialEndsAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      };

      const days = subscriptionService.getTrialDaysRemaining(subscription);

      expect(days).toBe(0);
    });

    it('should return 0 if trial is not active', () => {
      const subscription: any = {
        status: 'active',
      };

      const days = subscriptionService.getTrialDaysRemaining(subscription);

      expect(days).toBe(0);
    });
  });

  describe('Feature Gating Logic', () => {
    it('should enforce member limits for free tier', () => {
      const freeLimits = subscriptionService.getTierLimits('free');
      const standardLimits = subscriptionService.getTierLimits('standard');
      const premiumLimits = subscriptionService.getTierLimits('premium');

      expect(freeLimits.maxMembersPerHousehold).toBe(2);
      expect(standardLimits.maxMembersPerHousehold).toBe(4);
      expect(premiumLimits.maxMembersPerHousehold).toBe(12);
    });

    it('should enforce household limits correctly', () => {
      const freeLimits = subscriptionService.getTierLimits('free');
      const standardLimits = subscriptionService.getTierLimits('standard');
      const premiumLimits = subscriptionService.getTierLimits('premium');

      expect(freeLimits.maxHouseholds).toBe(1);
      expect(standardLimits.maxHouseholds).toBe(1);
      expect(premiumLimits.maxHouseholds).toBe(-1); // unlimited
    });

    it('should enable all core features for all tiers', () => {
      ['free', 'standard', 'premium'].forEach(tier => {
        const limits = subscriptionService.getTierLimits(tier as SubscriptionTier);
        
        expect(limits.canUsePatterns).toBe(true);
        expect(limits.canUseTwoWeekView).toBe(true);
        expect(limits.canAddNotes).toBe(true);
      });
    });

    it('should only enable calendar export for premium', () => {
      expect(subscriptionService.getTierLimits('free').canExportCalendar).toBe(false);
      expect(subscriptionService.getTierLimits('standard').canExportCalendar).toBe(false);
      expect(subscriptionService.getTierLimits('premium').canExportCalendar).toBe(true);
    });

    it('should only enable priority support for premium', () => {
      expect(subscriptionService.getTierLimits('free').hasPrioritySupport).toBe(false);
      expect(subscriptionService.getTierLimits('standard').hasPrioritySupport).toBe(false);
      expect(subscriptionService.getTierLimits('premium').hasPrioritySupport).toBe(true);
    });
  });

  describe('Ad Display Logic', () => {
    it('should show ads to all free tier users', () => {
      const subscription: any = {tier: 'free'};
      
      expect(subscriptionService.shouldShowAds(subscription, true)).toBe(true);
      expect(subscriptionService.shouldShowAds(subscription, false)).toBe(true);
    });

    it('should hide ads from standard admin, show to members', () => {
      const subscription: any = {tier: 'standard'};
      
      expect(subscriptionService.shouldShowAds(subscription, true)).toBe(false);
      expect(subscriptionService.shouldShowAds(subscription, false)).toBe(true);
    });

    it('should hide ads from all premium users', () => {
      const subscription: any = {tier: 'premium'};
      
      expect(subscriptionService.shouldShowAds(subscription, true)).toBe(false);
      expect(subscriptionService.shouldShowAds(subscription, false)).toBe(false);
    });
  });

  describe('Upgrade Paths', () => {
    it('should allow upgrade from free to standard', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo({
        tier: 'free',
        status: 'active',
      } as any);

      expect(info.canUpgradeToStandard).toBe(true);
    });

    it('should allow upgrade from free to premium', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo({
        tier: 'free',
        status: 'active',
      } as any);

      expect(info.canUpgradeToPremium).toBe(true);
    });

    it('should allow upgrade from standard to premium', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo({
        tier: 'standard',
        status: 'active',
      } as any);

      expect(info.canUpgradeToPremium).toBe(true);
      expect(info.canUpgradeToStandard).toBe(false);
    });

    it('should not allow any upgrades from premium', () => {
      const info = subscriptionService.getSubscriptionDisplayInfo({
        tier: 'premium',
        status: 'active',
      } as any);

      expect(info.canUpgradeToStandard).toBe(false);
      expect(info.canUpgradeToPremium).toBe(false);
    });
  });
});
