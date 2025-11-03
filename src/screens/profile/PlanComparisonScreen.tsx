/**
 * Plan Comparison Screen
 * Shows all available subscription plans with features and pricing
 * 
 * PAYMENT INTEGRATION: ✅ COMPLETE
 * ================================
 * - RevenueCat integrated for subscription management
 * - Purchase flow implemented with error handling
 * - Entitlement verification after purchase
 * - Platform-specific payment handling (iOS/Android)
 * - Firestore subscription tier synced with RevenueCat
 * 
 * PRODUCTION CHECKLIST:
 * ================================
 * 1. ✅ RevenueCat dashboard configured with products
 * 2. ✅ App Store Connect / Play Console products created
 * 3. ⚠️  Test sandbox payments on both platforms
 * 4. ⚠️  Configure webhooks for payment status updates (optional but recommended)
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {PricingInfo, subscriptionService, Subscription, SubscriptionTier} from '@/services/subscription.service';
import {revenueCatService} from '@/services/revenueCat.service';
import {spacing, typography, borderRadius} from '@/utils/responsive';
import {useAuth} from '@/contexts/AuthContext';
import {showAlert, showConfirm} from '@/utils/alert';

export const PlanComparisonScreen: React.FC = () => {
  const navigation = useNavigation();
  const {user} = useAuth();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  
  // Reload subscription when screen comes into focus (e.g., after payment success)
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentSubscription();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadCurrentSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const subscription = await subscriptionService.getUserSubscription(user.id);
      if (subscription) {
        // Handle both 'tier' and 'plan' properties (service may return either)
        const tierValue = (subscription as any).tier || (subscription as any).plan || 'free';
        setCurrentTier(tierValue as SubscriptionTier);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      // Default to free tier on error
      setCurrentTier('free');
    } finally {
      setLoading(false);
    }
  };
  
  // Inline pricing data as workaround for bundler issue
  const plans: PricingInfo[] = [
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
        'All core features',
        'Banner ads (coming soon)',
      ],
    },
    {
      tier: 'standard',
      name: 'Standard',
      priceMonthly: 2.99,
      priceYearly: 29.99,
      currency: 'GBP',
      features: [
        '1 household',
        'Up to 4 members',
        'Unlimited shifts & notes',
        'All core features',
        'Ad-free (when ads launch)',
      ],
    },
    {
      tier: 'premium',
      name: 'Premium',
      priceMonthly: 7.99,
      priceYearly: 79.99,
      currency: 'GBP',
      features: [
        'Unlimited households',
        'Up to 12 members per household',
        'Unlimited shifts & notes',
        'All core features',
        'Ad-free (when ads launch)',
        'Calendar export',
        'Priority support',
      ],
    },
  ];

  const handleSelectPlan = async (plan: PricingInfo) => {
    if (!user) {
      showAlert('Error', 'You must be logged in to change subscription plans.');
      return;
    }
    
    // Check if this is the current plan
    if (plan.tier === currentTier) {
      showAlert('Current Plan', 'This is your current subscription plan.');
      return;
    }
    
    // Determine if upgrade or downgrade
    const tierOrder = {free: 0, standard: 1, premium: 2};
    const isUpgrade = tierOrder[plan.tier] > tierOrder[currentTier];
    const isDowngrade = tierOrder[plan.tier] < tierOrder[currentTier];
    
    if (isDowngrade) {
      // Handle downgrade - FREE (no payment processing needed)
      showConfirm(
        'Downgrade Plan',
        `Are you sure you want to downgrade to ${plan.name}?\n\nYou'll lose access to some features at the end of your billing period.\n\nCurrent: ${currentTier.toUpperCase()}\nNew: ${plan.tier.toUpperCase()}`,
        async () => {
          try {
            setLoading(true);
            
            // Update subscription in Firestore
            await subscriptionService.changeSubscriptionTier(user.id, plan.tier);
            
            await loadCurrentSubscription();
            
            showAlert(
              'Downgrade Scheduled',
              `Your plan will be downgraded to ${plan.name} at the end of your current billing period.\n\nYou'll continue to have ${currentTier} access until then.`
            );
          } catch (error) {
            console.error('[PlanComparison] Downgrade failed:', error);
            showAlert('Error', 'Failed to downgrade subscription. Please try again.');
          } finally {
            setLoading(false);
          }
        }
      );
    } else if (isUpgrade) {
      // Handle upgrade - REQUIRES PAYMENT via RevenueCat
      const monthlyPrice = plan.priceMonthly.toFixed(2);
      const yearlyPrice = plan.priceYearly.toFixed(2);
      
      showConfirm(
        'Upgrade Plan',
        `Upgrade to ${plan.name}?\n\nMonthly: £${monthlyPrice}/month\nYearly: £${yearlyPrice}/year (save 16%)\n\nCurrent: ${currentTier.toUpperCase()}\nNew: ${plan.tier.toUpperCase()}`,
        async () => {
          try {
            setLoading(true);
            
            // Skip payment on web platform (RevenueCat doesn't support web)
            if (Platform.OS === 'web') {
              console.warn('[PlanComparison] Web platform - updating tier without payment');
              await subscriptionService.changeSubscriptionTier(user.id, plan.tier);
              await loadCurrentSubscription();
              showAlert(
                'Upgrade Successful (Test Mode)',
                `Welcome to ${plan.name}!\n\n⚠️ Web platform - no payment processed.`
              );
              return;
            }
            
            // Get available packages from RevenueCat
            const offerings = await revenueCatService.getOfferings();
            
            if (!offerings || offerings.length === 0) {
              throw new Error('No subscription packages available. Please try again later.');
            }
            
            // Find the appropriate package for the selected tier
            // RevenueCat package identifiers should match your product IDs
            const targetPackage = offerings.find(pkg => {
              const identifier = pkg.identifier.toLowerCase();
              return identifier.includes(plan.tier.toLowerCase()) && identifier.includes('monthly');
            });
            
            if (!targetPackage) {
              throw new Error(`No package found for ${plan.name}. Please contact support.`);
            }
            
            // Initiate purchase flow
            const customerInfo = await revenueCatService.purchasePackage(targetPackage);
            
            if (!customerInfo) {
              throw new Error('Purchase failed. Please try again.');
            }
            
            // Verify purchase and update Firestore subscription
            const hasEntitlement = plan.tier === 'premium' 
              ? revenueCatService.hasEntitlement('premium')
              : revenueCatService.hasEntitlement('standard');
            
            if (hasEntitlement) {
              // Purchase successful - update Firestore
              await subscriptionService.changeSubscriptionTier(user.id, plan.tier);
              await loadCurrentSubscription();
              
              showAlert(
                'Upgrade Successful! 🎉',
                `Welcome to ${plan.name}!\n\nYour subscription is now active. Enjoy your new features!`
              );
            } else {
              throw new Error('Purchase verification failed. Please contact support if you were charged.');
            }
            
          } catch (error: any) {
            console.error('[PlanComparison] Upgrade failed:', error);
            
            // Handle specific error cases
            if (error.message && error.message.includes('cancelled')) {
              showAlert('Purchase Cancelled', 'You cancelled the purchase. No charges were made.');
            } else if (error.message && error.message.includes('already owned')) {
              showAlert('Already Subscribed', 'You already own this subscription. Refreshing your status...');
              await loadCurrentSubscription();
            } else {
              showAlert(
                'Upgrade Failed', 
                error.message || 'Failed to upgrade subscription. Please try again or contact support.'
              );
            }
          } finally {
            setLoading(false);
          }
        }
      );
    }
  };

  const getButtonText = (planTier: SubscriptionTier): string => {
    if (planTier === currentTier) return 'Current Plan';
    
    const tierOrder = {free: 0, standard: 1, premium: 2};
    const isUpgrade = tierOrder[planTier] > tierOrder[currentTier];
    
    if (isUpgrade) return 'Upgrade';
    return 'Downgrade';
  };

  const getButtonStyle = (planTier: SubscriptionTier) => {
    if (planTier === currentTier) return styles.currentPlanButton;
    
    const tierOrder = {free: 0, standard: 1, premium: 2};
    const isUpgrade = tierOrder[planTier] > tierOrder[currentTier];
    
    if (isUpgrade) return styles.upgradeButton;
    return styles.downgradeButton;
  };

  const getPlanStyle = (tier: string) => {
    if (tier === 'premium') return styles.premiumPlan;
    if (tier === 'standard') return styles.standardPlan;
    return styles.freePlan;
  };

  const getPlanHeaderStyle = (tier: string) => {
    if (tier === 'premium') return styles.premiumHeader;
    if (tier === 'standard') return styles.standardHeader;
    return styles.freeHeader;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            All plans include unlimited shifts and notes. Upgrade for more households and members!
          </Text>
        </View>

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <View key={plan.tier} style={[styles.planCard, getPlanStyle(plan.tier)]}>
              {/* Badge for Premium or Current Plan */}
              {plan.tier === 'premium' && plan.tier !== currentTier && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}
              {plan.tier === currentTier && (
                <View style={styles.currentPlanBadge}>
                  <Text style={styles.currentPlanBadgeText}>CURRENT PLAN</Text>
                </View>
              )}

              {/* Plan Header */}
              <View style={[styles.planHeader, getPlanHeaderStyle(plan.tier)]}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceContainer}>
                  {plan.priceMonthly > 0 ? (
                    <>
                      <Text style={styles.currency}>£</Text>
                      <Text style={styles.price}>{plan.priceMonthly.toFixed(2)}</Text>
                      <Text style={styles.period}>/month</Text>
                    </>
                  ) : (
                    <Text style={styles.priceFREE}>FREE</Text>
                  )}
                </View>
                {plan.priceYearly > 0 && (
                  <Text style={styles.yearlyPrice}>
                    or £{plan.priceYearly.toFixed(2)}/year (save 16%)
                  </Text>
                )}
              </View>

              {/* Features */}
              <View style={styles.featuresContainer}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {/* Select Button */}
              <TouchableOpacity
                style={[styles.selectButton, getButtonStyle(plan.tier)]}
                onPress={() => handleSelectPlan(plan)}
                disabled={plan.tier === currentTier}>
                <Text style={styles.selectButtonText}>
                  {getButtonText(plan.tier)}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* FAQ */}
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>Frequently Asked Questions</Text>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I cancel anytime?</Text>
            <Text style={styles.faqAnswer}>
              Yes! You can cancel your subscription at any time. You'll keep access until the end of your billing period.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>What happens to my data if I downgrade?</Text>
            <Text style={styles.faqAnswer}>
              Your data is safe! If you exceed limits after downgrading, you'll be prompted to remove extra households or members.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Are there any hidden fees?</Text>
            <Text style={styles.faqAnswer}>
              No! The price you see is what you pay. No setup fees, no hidden charges.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={styles.faqQuestion}>Can I try before buying?</Text>
            <Text style={styles.faqAnswer}>
              The Free plan lets you try all core features! Upgrade when you need more households or members.
            </Text>
          </View>
        </View>

        {/* Support */}
        <View style={styles.supportSection}>
          <Text style={styles.supportText}>
            Have questions? Contact us at support@linkshift.app
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: typography.body,
    color: '#6366F1',
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body,
    color: '#A1A1AA',
    lineHeight: 22,
  },
  plansContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  planCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 2,
    position: 'relative',
  },
  freePlan: {
    backgroundColor: '#1F1F37',
    borderColor: '#2A2A3E',
  },
  standardPlan: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  premiumPlan: {
    backgroundColor: '#1E1B2E',
    borderColor: '#8B5CF6',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentPlanBadge: {
    position: 'absolute',
    top: -12,
    right: spacing.lg,
    backgroundColor: '#10B981',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  currentPlanBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planHeader: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
  },
  freeHeader: {
    borderBottomColor: '#2A2A3E',
  },
  standardHeader: {
    borderBottomColor: '#3B82F6',
  },
  premiumHeader: {
    borderBottomColor: '#8B5CF6',
  },
  planName: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  currency: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  price: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 4,
  },
  priceFREE: {
    fontSize: 36,
    fontWeight: '700',
    color: '#10B981',
  },
  period: {
    fontSize: typography.body,
    color: '#A1A1AA',
  },
  yearlyPrice: {
    fontSize: typography.caption,
    color: '#10B981',
  },
  featuresContainer: {
    marginBottom: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  featureIcon: {
    fontSize: 16,
    color: '#10B981',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  featureText: {
    fontSize: typography.body,
    color: '#B4B4C8',
    flex: 1,
  },
  selectButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  freeButton: {
    backgroundColor: '#374151',
  },
  standardButton: {
    backgroundColor: '#3B82F6',
  },
  premiumButton: {
    backgroundColor: '#8B5CF6',
  },
  currentPlanButton: {
    backgroundColor: '#10B981',
    opacity: 0.6,
  },
  upgradeButton: {
    backgroundColor: '#6366F1',
  },
  downgradeButton: {
    backgroundColor: '#DC2626',
  },
  selectButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  faqSection: {
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  faqTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.lg,
  },
  faqItem: {
    marginBottom: spacing.lg,
  },
  faqQuestion: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  faqAnswer: {
    fontSize: typography.caption,
    color: '#A1A1AA',
    lineHeight: 18,
  },
  supportSection: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  supportText: {
    fontSize: typography.caption,
    color: '#6366F1',
    textAlign: 'center',
  },
});
