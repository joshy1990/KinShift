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

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {subscriptionService} from '@/services/subscription.service';
import type {SubscriptionTier} from '@/services/revenueCat.service';
import {revenueCatService} from '@/services/revenueCat.service';
import {PurchasesPackage, PACKAGE_TYPE} from 'react-native-purchases';
import {spacing, typography, borderRadius} from '@/utils/responsive';
import {useAuth} from '@/contexts/AuthContext';
import {showAlert, showConfirm} from '@/utils/alert';

/** Plan info displayed on screen — prices come from the store via RevenueCat */
interface PlanDisplayInfo {
  tier: SubscriptionTier;
  name: string;
  /** Localized price string from the store, e.g. "$3.99" or "£3.99" */
  monthlyPriceString: string | null;
  yearlyPriceString: string | null;
  /** Savings text, e.g. "save 16%" */
  savingsText: string | null;
  features: string[];
  /** The RevenueCat packages — stored so we can purchase directly */
  monthlyPackage: PurchasesPackage | null;
  yearlyPackage: PurchasesPackage | null;
}

export const PlanComparisonScreen: React.FC = () => {
  const navigation = useNavigation();
  const {user} = useAuth();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [plans, setPlans] = useState<PlanDisplayInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Reload subscription + pricing when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCurrentSubscription(), loadPricing()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentSubscription = async () => {
    if (!user) return;
    try {
      const subscription = await subscriptionService.getUserSubscription(user.id);
      if (subscription) {
        const tierValue = (subscription as any).tier || (subscription as any).plan || 'free';
        setCurrentTier(tierValue as SubscriptionTier);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      setCurrentTier('free');
    }
  };

  /** Fetch localized prices from RevenueCat / the store */
  const loadPricing = async () => {
    // Always start with the free plan (no store prices needed)
    const freePlan: PlanDisplayInfo = {
      tier: 'free',
      name: 'Free',
      monthlyPriceString: null,
      yearlyPriceString: null,
      savingsText: null,
      features: [
        '1 household',
        'Up to 2 members',
        'Unlimited shifts & notes',
        'All core features',
      ],
      monthlyPackage: null,
      yearlyPackage: null,
    };

    try {
      const packages = await revenueCatService.getOfferings();

      // Find monthly and annual packages
      const monthlyPkg = packages.find(
        p => p.packageType === PACKAGE_TYPE.MONTHLY,
      ) ?? packages.find(
        p => p.identifier.toLowerCase().includes('monthly'),
      ) ?? null;

      const annualPkg = packages.find(
        p => p.packageType === PACKAGE_TYPE.ANNUAL,
      ) ?? packages.find(
        p => p.identifier.toLowerCase().includes('annual') ||
             p.identifier.toLowerCase().includes('yearly'),
      ) ?? null;

      // Calculate savings percentage if both prices are available
      let savingsText: string | null = null;
      if (monthlyPkg && annualPkg) {
        const monthlyAnnualized = monthlyPkg.product.price * 12;
        const yearlyPrice = annualPkg.product.price;
        if (monthlyAnnualized > 0) {
          const pct = Math.round(((monthlyAnnualized - yearlyPrice) / monthlyAnnualized) * 100);
          if (pct > 0) savingsText = `save ${pct}%`;
        }
      }

      const proPlan: PlanDisplayInfo = {
        tier: 'pro',
        name: 'Pro',
        monthlyPriceString: monthlyPkg?.product.priceString ?? null,
        yearlyPriceString: annualPkg?.product.priceString ?? null,
        savingsText,
        features: [
          'Unlimited households',
          'Up to 12 members per household',
          'Unlimited shifts & notes',
          'All core features',
          'Ad-free',
          'Calendar export',
          'Priority support',
        ],
        monthlyPackage: monthlyPkg,
        yearlyPackage: annualPkg,
      };

      setPlans([freePlan, proPlan]);
    } catch (error) {
      console.error('Failed to load pricing from store:', error);
      // Fallback — show plans without prices (purchase button will fetch again)
      const fallbackPro: PlanDisplayInfo = {
        tier: 'pro',
        name: 'Pro',
        monthlyPriceString: null,
        yearlyPriceString: null,
        savingsText: null,
        features: [
          'Unlimited households',
          'Up to 12 members per household',
          'Unlimited shifts & notes',
          'All core features',
          'Ad-free',
          'Calendar export',
          'Priority support',
        ],
        monthlyPackage: null,
        yearlyPackage: null,
      };
      setPlans([freePlan, fallbackPro]);
    }
  };

  const handleSelectPlan = async (plan: PlanDisplayInfo) => {
    if (!user) {
      showAlert('Error', 'You must be logged in to change subscription plans.');
      return;
    }

    if (plan.tier === currentTier) {
      showAlert('Current Plan', 'This is your current subscription plan.');
      return;
    }

    const tierOrder: Record<string, number> = {free: 0, pro: 1};
    const isUpgrade = (tierOrder[plan.tier] ?? 0) > (tierOrder[currentTier] ?? 0);
    const isDowngrade = (tierOrder[plan.tier] ?? 0) < (tierOrder[currentTier] ?? 0);

    if (isDowngrade) {
      showConfirm(
        'Downgrade Plan',
        `To downgrade to ${plan.name}, you need to change your subscription in your App Store or Google Play Store settings.\n\nYour current plan will remain active until the end of your billing period.`,
        () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('https://apps.apple.com/account/subscriptions');
          } else if (Platform.OS === 'android') {
            Linking.openURL('https://play.google.com/store/account/subscriptions');
          } else {
            showAlert(
              'Manage Subscription',
              'Please manage your subscription through the App Store (iOS) or Google Play Store (Android).'
            );
          }
        }
      );
    } else if (isUpgrade) {
      // Build price line for confirm dialog using store-localized strings
      const priceLine = [
        plan.monthlyPriceString ? `${plan.monthlyPriceString}/month` : null,
        plan.yearlyPriceString ? `${plan.yearlyPriceString}/year` : null,
      ].filter(Boolean).join('\n');

      showConfirm(
        'Upgrade Plan',
        `Upgrade to ${plan.name}?\n\n${priceLine || 'Pricing shown at checkout'}`,
        async () => {
          try {
            setLoading(true);

            if (Platform.OS === 'web') {
              showAlert(
                'Not Available',
                'Subscriptions are only available on the mobile app. Please upgrade from iOS or Android.'
              );
              return;
            }

            // Use the monthly package we already fetched, or re-fetch
            let targetPackage = plan.monthlyPackage;
            if (!targetPackage) {
              const offerings = await revenueCatService.getOfferings();
              targetPackage = offerings.find(
                p => p.packageType === PACKAGE_TYPE.MONTHLY,
              ) ?? offerings.find(
                p => p.identifier.toLowerCase().includes('monthly'),
              ) ?? null;
            }

            if (!targetPackage) {
              throw new Error('No subscription packages available. Please try again later.');
            }

            const customerInfo = await revenueCatService.purchasePackage(targetPackage);
            if (!customerInfo) {
              throw new Error('Purchase failed. Please try again.');
            }

            if (revenueCatService.isPro) {
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
            if (error.message?.includes('cancelled')) {
              showAlert('Purchase Cancelled', 'You cancelled the purchase. No charges were made.');
            } else if (error.message?.includes('already owned')) {
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
    
    const tierOrder: Record<string, number> = {free: 0, pro: 1};
    const isUpgrade = (tierOrder[planTier] ?? 0) > (tierOrder[currentTier] ?? 0);
    
    if (isUpgrade) return 'Upgrade';
    return 'Downgrade';
  };

  const getButtonStyle = (planTier: SubscriptionTier) => {
    if (planTier === currentTier) return styles.currentPlanButton;
    
    const tierOrder: Record<string, number> = {free: 0, pro: 1};
    const isUpgrade = (tierOrder[planTier] ?? 0) > (tierOrder[currentTier] ?? 0);
    
    if (isUpgrade) return styles.upgradeButton;
    return styles.downgradeButton;
  };

  const getPlanStyle = (tier: string) => {
    if (tier === 'pro') return styles.proPlan;
    return styles.freePlan;
  };

  const getPlanHeaderStyle = (tier: string) => {
    if (tier === 'pro') return styles.proHeader;
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : (
        <>
        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <View key={plan.tier} style={[styles.planCard, getPlanStyle(plan.tier)]}>
              {/* Badge */}
              {plan.tier === 'pro' && plan.tier !== currentTier && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>RECOMMENDED</Text>
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
                  {plan.monthlyPriceString ? (
                    <>
                      <Text style={styles.priceLocalized}>{plan.monthlyPriceString}</Text>
                      <Text style={styles.period}>/month</Text>
                    </>
                  ) : (
                    <Text style={styles.priceFREE}>FREE</Text>
                  )}
                </View>
                {plan.yearlyPriceString && (
                  <Text style={styles.yearlyPrice}>
                    or {plan.yearlyPriceString}/year{plan.savingsText ? ` (${plan.savingsText})` : ''}
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
            Have questions? Contact us at support@offeryn.co.uk
          </Text>
          <Text style={styles.companyText}>
            © 2026 Offeryn Software Ltd
          </Text>
        </View>
        </>
        )}
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
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: '#A1A1AA',
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
  proPlan: {
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
  proHeader: {
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
  priceLocalized: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
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
  proButton: {
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
  companyText: {
    fontSize: typography.caption,
    color: '#555',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
