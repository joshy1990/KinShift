import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {subscriptionService, PricingInfo} from '../../services/subscription.service';
import {useAuth} from '../../contexts/AuthContext';

interface PricingScreenProps {
  navigation: any;
}

export const PricingScreen: React.FC<PricingScreenProps> = ({navigation}) => {
  const {user} = useAuth();
  const [pricing, setPricing] = useState<PricingInfo[]>([]);
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      const pricingData = subscriptionService.getPricingInfo();
      setPricing(pricingData);

      if (user?.id) {
        const subscription = await subscriptionService.getUserSubscription(user.id);
        if (subscription) {
          setCurrentTier(subscription.tier);
        }
      }
    } catch (error) {
      console.error('Error loading pricing:', error);
      Alert.alert('Error', 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to upgrade');
      return;
    }

    if (tier === currentTier) {
      Alert.alert('Already Subscribed', `You're already on the ${tier} plan`);
      return;
    }

    if (tier === 'free') {
      Alert.alert(
        'Downgrade Subscription',
        'Are you sure you want to downgrade to the free plan? You may lose access to some features.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Downgrade',
            style: 'destructive',
            onPress: () => processDowngrade(),
          },
        ]
      );
      return;
    }

    setUpgrading(tier);
    try {
      // In production, this would integrate with Stripe/App Store
      // For now, we'll just simulate the upgrade
      if (tier === 'standard') {
        await subscriptionService.upgradeToStandard(user.id);
      } else if (tier === 'premium') {
        await subscriptionService.upgradeToPremium(user.id);
      }

      Alert.alert(
        'Success!',
        `You've been upgraded to ${tier}. Enjoy your new features!`,
        [
          {
            text: 'OK',
            onPress: () => {
              setCurrentTier(tier);
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error upgrading:', error);
      Alert.alert('Error', 'Failed to upgrade subscription. Please try again.');
    } finally {
      setUpgrading(null);
    }
  };

  const processDowngrade = async () => {
    if (!user?.id) return;

    setUpgrading('free');
    try {
      await subscriptionService.downgradeToFree(user.id);
      Alert.alert('Downgraded', 'Your subscription has been downgraded to the free plan.');
      setCurrentTier('free');
    } catch (error) {
      console.error('Error downgrading:', error);
      Alert.alert('Error', 'Failed to downgrade subscription.');
    } finally {
      setUpgrading(null);
    }
  };

  const getPrice = (tier: PricingInfo) => {
    const price = billingPeriod === 'monthly' ? tier.priceMonthly : tier.priceYearly;
    if (price === 0) return 'Free';
    if (billingPeriod === 'yearly') {
      return `£${price}/year`;
    }
    return `£${price}/mo`;
  };

  const getSavings = (tier: PricingInfo) => {
    if (tier.priceMonthly === 0) return null;
    const monthlyTotal = tier.priceMonthly * 12;
    const savings = monthlyTotal - tier.priceYearly;
    return savings > 0 ? `Save £${savings.toFixed(2)}` : null;
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free':
        return '#6B7280';
      case 'standard':
        return '#6366F1';
      case 'premium':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const isCurrentTier = (tier: string) => tier === currentTier;

  const canUpgrade = (tier: string) => {
    if (tier === 'free') return currentTier !== 'free';
    if (tier === 'standard') return currentTier === 'free';
    if (tier === 'premium') return currentTier !== 'premium';
    return false;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Plan</Text>
        <Text style={styles.subtitle}>
          Select the plan that works best for your family
        </Text>

        {/* Billing Period Toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingPeriod === 'monthly' && styles.billingOptionActive,
            ]}
            onPress={() => setBillingPeriod('monthly')}>
            <Text
              style={[
                styles.billingOptionText,
                billingPeriod === 'monthly' && styles.billingOptionTextActive,
              ]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingPeriod === 'yearly' && styles.billingOptionActive,
            ]}
            onPress={() => setBillingPeriod('yearly')}>
            <Text
              style={[
                styles.billingOptionText,
                billingPeriod === 'yearly' && styles.billingOptionTextActive,
              ]}>
              Yearly
            </Text>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>Save up to 17%</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pricing Cards */}
      <View style={styles.cardsContainer}>
        {pricing.map(tier => {
          const color = getTierColor(tier.tier);
          const isCurrent = isCurrentTier(tier.tier);
          const canUpgradeToTier = canUpgrade(tier.tier);
          const savings = billingPeriod === 'yearly' ? getSavings(tier) : null;

          return (
            <View
              key={tier.tier}
              style={[
                styles.card,
                isCurrent && styles.cardCurrent,
                tier.tier === 'premium' && styles.cardPremium,
              ]}>
              {/* Tier Badge */}
              {tier.tier === 'premium' && (
                <View style={[styles.popularBadge, {backgroundColor: color}]}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              {isCurrent && (
                <View style={[styles.currentBadge, {backgroundColor: color}]}>
                  <Text style={styles.currentBadgeText}>CURRENT PLAN</Text>
                </View>
              )}

              {/* Tier Header */}
              <View style={styles.cardHeader}>
                <Text style={[styles.tierName, {color}]}>{tier.name}</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>{getPrice(tier)}</Text>
                  {savings && (
                    <Text style={styles.savings}>{savings}</Text>
                  )}
                </View>
              </View>

              {/* Features List */}
              <View style={styles.featuresContainer}>
                {tier.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {/* Action Button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  isCurrent && styles.buttonCurrent,
                  !canUpgradeToTier && !isCurrent && styles.buttonDisabled,
                  {
                    borderColor: color,
                    backgroundColor: canUpgradeToTier ? color : 'transparent',
                  },
                ]}
                onPress={() => handleUpgrade(tier.tier)}
                disabled={isCurrent || upgrading !== null}>
                {upgrading === tier.tier ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      canUpgradeToTier && styles.buttonTextActive,
                    ]}>
                    {isCurrent
                      ? 'Current Plan'
                      : canUpgradeToTier
                      ? tier.tier === 'free'
                        ? 'Downgrade'
                        : 'Upgrade'
                      : 'Not Available'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          • All plans include 14-day free trial
        </Text>
        <Text style={styles.footerText}>
          • Cancel anytime, no questions asked
        </Text>
        <Text style={styles.footerText}>
          • Secure payment via Stripe
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  billingOptionActive: {
    backgroundColor: '#6366F1',
  },
  billingOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  billingOptionTextActive: {
    color: '#FFFFFF',
  },
  savingsBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  savingsBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardsContainer: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardCurrent: {
    borderColor: '#6366F1',
  },
  cardPremium: {
    borderColor: '#F59E0B',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    left: 20,
    right: 20,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  currentBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardHeader: {
    marginBottom: 20,
    marginTop: 8,
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  savings: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 18,
    color: '#10B981',
    marginRight: 12,
    fontWeight: 'bold',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  buttonCurrent: {
    backgroundColor: 'transparent',
    borderColor: '#6B7280',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  buttonTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
});
