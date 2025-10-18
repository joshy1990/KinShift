import {subscriptionService} from '../../../services/subscription.service';

describe('PricingScreen Integration', () => {
  it('should have getPricingInfo return all three tiers', () => {
    const pricing = subscriptionService.getPricingInfo();

    expect(pricing).toHaveLength(3);
    expect(pricing.map(p => p.tier)).toEqual(['free', 'standard', 'premium']);
  });

  it('should format prices correctly for display', () => {
    const pricing = subscriptionService.getPricingInfo();

    const free = pricing.find(p => p.tier === 'free');
    expect(free?.priceMonthly).toBe(0);

    const standard = pricing.find(p => p.tier === 'standard');
    expect(standard?.priceMonthly).toBe(2.99);

    const premium = pricing.find(p => p.tier === 'premium');
    expect(premium?.priceMonthly).toBe(7.99);
  });

  it('should calculate yearly savings correctly', () => {
    const pricing = subscriptionService.getPricingInfo();

    const standard = pricing.find(p => p.tier === 'standard');
    const standardMonthlyCost = (standard?.priceMonthly || 0) * 12;
    const standardYearlyCost = standard?.priceYearly || 0;
    const standardSavings = standardMonthlyCost - standardYearlyCost;

    expect(standardSavings).toBeGreaterThan(0);
    expect(standardSavings).toBeCloseTo(5.89, 2);

    const premium = pricing.find(p => p.tier === 'premium');
    const premiumMonthlyCost = (premium?.priceMonthly || 0) * 12;
    const premiumYearlyCost = premium?.priceYearly || 0;
    const premiumSavings = premiumMonthlyCost - premiumYearlyCost;

    expect(premiumSavings).toBeGreaterThan(0);
    expect(premiumSavings).toBeCloseTo(15.89, 2);
  });

  it('should include all features for each tier', () => {
    const pricing = subscriptionService.getPricingInfo();

    pricing.forEach(tier => {
      expect(tier.features.length).toBeGreaterThan(0);
      expect(tier.currency).toBe('GBP');
    });
  });
});
