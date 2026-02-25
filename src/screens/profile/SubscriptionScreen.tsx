/**
 * Subscription Screen
 * Shows current subscription status and allows users to view/upgrade plans
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import {useAuth} from '@/contexts/AuthContext';
import {useSubscription} from '@/contexts/SubscriptionContext';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ProfileStackParamList} from '@/types';
import {subscriptionService} from '@/services/subscription.service';
import {revenueCatService} from '@/services/revenueCat.service';
import {getResponsiveValue, spacing, typography, borderRadius} from '@/utils/responsive';
import {showError, showSuccess} from '@/utils/alert';
import type {Subscription, SubscriptionDisplayInfo} from '@/services/subscription.service';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Subscription'>;

export const SubscriptionScreen: React.FC = () => {
  const {user} = useAuth();
  const subscriptionCtx = useSubscription();
  const navigation = useNavigation<NavigationProp>();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [displayInfo, setDisplayInfo] = useState<SubscriptionDisplayInfo | null>(null);

  // Reload subscription when screen comes into focus (e.g., after returning from payment)
  useFocusEffect(
    React.useCallback(() => {
      loadSubscription();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const loadSubscription = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const sub = await subscriptionService.getUserSubscription(user.id);
      setSubscription(sub);

      if (sub) {
        // Inline display info calculation as workaround
        const tierName = sub.tier === 'premium' ? 'Premium' : sub.tier === 'standard' ? 'Standard' : 'Free';
        const tierBadgeColor = sub.tier === 'premium' ? '#F59E0B' : sub.tier === 'standard' ? '#6366F1' : '#6B7280';
        
        let benefits: string[] = [];
        if (sub.tier === 'premium') {
          benefits = ['Unlimited households', 'Up to 12 members per household', 'Ad-free', 'Priority support', 'Calendar export'];
        } else if (sub.tier === 'standard') {
          benefits = ['1 household', 'Up to 4 members', 'Ad-free', 'All features'];
        } else {
          benefits = ['1 household', 'Up to 2 members', 'Unlimited shifts & notes', 'All core features'];
        }
        
        const info: SubscriptionDisplayInfo = {
          tierName,
          tierBadgeColor,
          statusText: sub.status === 'active' ? 'Active' : sub.status,
          statusColor: '#10B981',
          benefits,
          showUpgrade: sub.tier !== 'premium',
          canUpgradeToStandard: sub.tier === 'free',
          canUpgradeToPremium: sub.tier === 'free' || sub.tier === 'standard',
        };
        
        setDisplayInfo(info);
      } else {
        console.error('No subscription returned from service');
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
      showError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlans = () => {
    navigation.navigate('PlanComparison');
  };

  const handleCancelSubscription = () => {
    if (!subscription || !user) return;

    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel your ${displayInfo?.tierName} subscription?\n\nYou'll continue to have access until the end of your billing period, then your account will revert to the Free plan.`,
      [
        {
          text: 'Keep Subscription',
          style: 'cancel',
        },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            try {
              // Platform-specific cancellation
              if (Platform.OS === 'ios') {
                // iOS: Direct to Apple subscription management
                Alert.alert(
                  'Manage Subscription',
                  'To cancel your subscription, please go to:\n\nSettings → Your Name → Subscriptions → KinShift',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Open Settings',
                      onPress: () => {
                        Linking.openURL('https://apps.apple.com/account/subscriptions');
                      },
                    },
                  ]
                );
              } else if (Platform.OS === 'android') {
                // Android: Direct to Google Play subscription management
                Alert.alert(
                  'Manage Subscription',
                  'To cancel your subscription, please go to:\n\nGoogle Play Store → Menu → Subscriptions → KinShift',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Open Play Store',
                      onPress: () => {
                        Linking.openURL('https://play.google.com/store/account/subscriptions');
                      },
                    },
                  ]
                );
              } else {
                // Web platform
                Alert.alert(
                  'Cancel Subscription',
                  'Subscription cancellation is managed through the app stores. Please use the mobile app to cancel.',
                  [{text: 'OK'}]
                );
              }
            } catch (error) {
              console.error('Failed to open subscription management:', error);
              Alert.alert('Error', 'Failed to open subscription management. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleManageSubscription = () => {
    // Direct users to platform-specific subscription management
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Manage Subscription',
        'View your billing, payment method, and subscription details in iOS Settings.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openURL('https://apps.apple.com/account/subscriptions');
            },
          },
        ]
      );
    } else if (Platform.OS === 'android') {
      Alert.alert(
        'Manage Subscription',
        'View your billing, payment method, and subscription details in Google Play Store.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Open Play Store',
            onPress: () => {
              Linking.openURL('https://play.google.com/store/account/subscriptions');
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Manage Subscription',
        'Subscription management is available through the app stores. Please use the mobile app.',
        [{text: 'OK'}]
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      if (Platform.OS === 'web') {
        Alert.alert('Not Available', 'Purchase restoration is only available on mobile devices.');
        return;
      }

      const customerInfo = await revenueCatService.restorePurchases();
      
      if (!customerInfo) {
        Alert.alert('No Purchases Found', 'No previous purchases found for this account.');
        return;
      }

      // Check if any entitlements were restored
      const hasStandard = revenueCatService.hasEntitlement('standard');
      const hasPremium = revenueCatService.hasEntitlement('premium');
      
      if (hasStandard || hasPremium) {
        const restoredTier = hasPremium ? 'premium' : 'standard';
        
        // Update Firestore with restored subscription
        await subscriptionService.changeSubscriptionTier(user.id, restoredTier);
        await loadSubscription();
        
        Alert.alert(
          'Purchases Restored! 🎉',
          `Your ${restoredTier.charAt(0).toUpperCase() + restoredTier.slice(1)} subscription has been restored.`
        );
      } else {
        Alert.alert('No Active Subscription', 'No active subscription found to restore.');
      }
      
    } catch (error: any) {
      console.error('Failed to restore purchases:', error);
      Alert.alert(
        'Restore Failed',
        error.message || 'Failed to restore purchases. Please try again or contact support.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = () => {
    if (!subscription) return null;

    let badgeStyle = styles.freeBadge;
    let badgeText = 'FREE';

    if (subscription.tier === 'standard') {
      badgeStyle = styles.standardBadge;
      badgeText = 'STANDARD';
    } else if (subscription.tier === 'premium') {
      badgeStyle = styles.premiumBadge;
      badgeText = 'PREMIUM';
    }

    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeText}>{badgeText}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!subscription || !displayInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load subscription</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSubscription}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your Subscription</Text>
          <Text style={styles.subtitle}>Manage your plan and features</Text>
        </View>

        {/* Current Plan Card */}
        <View style={styles.currentPlanCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>{displayInfo.tierName} Plan</Text>
            {getTierBadge()}
          </View>

          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, {backgroundColor: displayInfo.statusColor}]} />
            <Text style={styles.statusText}>{displayInfo.statusText}</Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Your Benefits:</Text>
            {displayInfo.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Upgrade Section */}
        {displayInfo.showUpgrade && (
          <View style={styles.upgradeSection}>
            <Text style={styles.upgradeSectionTitle}>🚀 Upgrade Your Experience</Text>
            <Text style={styles.upgradeSectionText}>
              Get more households, members, and be ad-free when ads launch!
            </Text>

            <TouchableOpacity style={styles.viewPlansButton} onPress={handleViewPlans}>
              <Text style={styles.viewPlansButtonText}>View All Plans</Text>
              <Text style={styles.viewPlansArrow}>→</Text>
            </TouchableOpacity>

            {displayInfo.canUpgradeToStandard && (
              <View style={styles.quickUpgradeCard}>
                <Text style={styles.quickUpgradeTitle}>Standard Plan</Text>
                <Text style={styles.quickUpgradePrice}>£2.99/month</Text>
                <Text style={styles.quickUpgradeFeatures}>
                  • 4 members per household{'\n'}
                  • Ad-free{'\n'}
                  • All features unlocked
                </Text>
              </View>
            )}

            {displayInfo.canUpgradeToPremium && (
              <View style={styles.quickUpgradeCard}>
                <Text style={styles.quickUpgradeTitle}>Premium Plan</Text>
                <Text style={styles.quickUpgradePrice}>£4.99/month</Text>
                <Text style={styles.quickUpgradeFeatures}>
                  • Unlimited households{'\n'}
                  • 12 members per household{'\n'}
                  • Ad-free{'\n'}
                  • Priority support
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Manage Subscription Section - Only show for paid plans */}
        {subscription.tier !== 'free' && (
          <View style={styles.manageSection}>
            <Text style={styles.manageSectionTitle}>Manage Your Subscription</Text>
            
            <TouchableOpacity 
              style={styles.manageButton} 
              onPress={handleManageSubscription}
            >
              <Text style={styles.manageButtonText}>💳 Payment & Billing</Text>
              <Text style={styles.manageButtonArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleCancelSubscription}
            >
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            </TouchableOpacity>
            
            <Text style={styles.cancelNote}>
              You'll keep access until the end of your billing period
            </Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            💡 All plans include unlimited shifts, notes, and calendar features. 
            Upgrade for more households, members, and be ad-free when banner ads launch in the future!
          </Text>
        </View>

        {/* Restore Purchases Button - Only on mobile */}
        {Platform.OS !== 'web' && (
          <View style={styles.restoreSection}>
            <TouchableOpacity 
              style={styles.restoreButton} 
              onPress={handleRestorePurchases}
              disabled={loading}
            >
              <Text style={styles.restoreButtonText}>
                🔄 Restore Purchases
              </Text>
            </TouchableOpacity>
            <Text style={styles.restoreNote}>
              Already purchased? Tap to restore your subscription
            </Text>
          </View>
        )}

        {/* Support Link */}
        <TouchableOpacity style={styles.supportLink}>
          <Text style={styles.supportLinkText}>
            Need help? Contact support at support@offeryn.co.uk
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: typography.subtitle,
    color: '#DC2626',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
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
  title: {
    fontSize: typography.heading,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.body,
    color: '#A1A1AA',
  },
  currentPlanCard: {
    backgroundColor: '#1F1F37',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  planTitle: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  freeBadge: {
    backgroundColor: '#374151',
  },
  standardBadge: {
    backgroundColor: '#3B82F6',
  },
  premiumBadge: {
    backgroundColor: '#8B5CF6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: typography.caption,
    color: '#A1A1AA',
  },
  benefitsContainer: {
    marginTop: spacing.md,
  },
  benefitsTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  benefitIcon: {
    fontSize: 16,
    color: '#10B981',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  benefitText: {
    fontSize: typography.body,
    color: '#B4B4C8',
    flex: 1,
  },
  upgradeSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  upgradeSectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  upgradeSectionText: {
    fontSize: typography.body,
    color: '#A1A1AA',
    marginBottom: spacing.lg,
  },
  viewPlansButton: {
    backgroundColor: '#6366F1',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  viewPlansButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: spacing.sm,
  },
  viewPlansArrow: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  quickUpgradeCard: {
    backgroundColor: '#1F1F37',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    marginBottom: spacing.md,
  },
  quickUpgradeTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  quickUpgradePrice: {
    fontSize: typography.title,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: spacing.md,
  },
  quickUpgradeFeatures: {
    fontSize: typography.caption,
    color: '#B4B4C8',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  upgradeButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  upgradeButtonPremium: {
    backgroundColor: '#8B5CF6',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#1E293B',
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  infoText: {
    fontSize: typography.caption,
    color: '#94A3B8',
    lineHeight: 18,
  },
  supportLink: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  supportLinkText: {
    fontSize: typography.caption,
    color: '#6366F1',
    textAlign: 'center',
  },
  manageSection: {
    backgroundColor: '#1E293B',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  manageSectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  manageButtonText: {
    fontSize: typography.body,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  manageButtonArrow: {
    fontSize: 20,
    color: '#94A3B8',
  },
  cancelButton: {
    backgroundColor: '#DC2626',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelNote: {
    fontSize: typography.caption,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  restoreSection: {
    backgroundColor: '#1E293B',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  restoreButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  restoreButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  restoreNote: {
    marginTop: spacing.sm,
    fontSize: typography.caption,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
