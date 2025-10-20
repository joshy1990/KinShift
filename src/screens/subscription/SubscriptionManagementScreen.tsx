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
import {
  subscriptionService,
  Subscription,
  SubscriptionDisplayInfo,
} from '../../services/subscription.service';
import {useAuth} from '../../contexts/AuthContext';

interface SubscriptionManagementScreenProps {
  navigation: any;
}

export const SubscriptionManagementScreen: React.FC<
  SubscriptionManagementScreenProps
> = ({navigation}) => {
  const {user} = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [displayInfo, setDisplayInfo] = useState<SubscriptionDisplayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubscription = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const sub = await subscriptionService.getUserSubscription(user.id);
      if (!sub) {
        throw new Error('Failed to load subscription');
      }
      const info = subscriptionService.getSubscriptionDisplayInfo(sub);
      setSubscription(sub);
      setDisplayInfo(info);
    } catch (error) {
      console.error('Error loading subscription:', error);
      Alert.alert('Error', 'Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPricing = () => {
    navigation.navigate('Pricing');
  };

  const handleCancelSubscription = () => {
    if (!subscription || subscription.tier === 'free') {
      Alert.alert('Info', 'You are on the free plan');
      return;
    }

    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel? You will lose access to premium features at the end of your billing period.',
      [
        {text: 'Keep Subscription', style: 'cancel'},
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: processCancellation,
        },
      ]
    );
  };

  const processCancellation = async () => {
    if (!user?.id) return;

    setCanceling(true);
    try {
      await subscriptionService.cancelSubscription(user.id);
      Alert.alert(
        'Subscription Canceled',
        'Your subscription will remain active until the end of your billing period.',
        [{text: 'OK', onPress: loadSubscription}]
      );
    } catch (error) {
      console.error('Error canceling subscription:', error);
      Alert.alert('Error', 'Failed to cancel subscription. Please try again.');
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (!subscription || !displayInfo) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load subscription</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadSubscription}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTrialing = subscriptionService.isTrialActive(subscription);
  const trialDaysRemaining = subscriptionService.getTrialDaysRemaining(subscription);

  return (
    <ScrollView style={styles.container}>
      {/* Trial Banner */}
      {isTrialing && (
        <View style={styles.trialBanner}>
          <Text style={styles.trialBannerIcon}>🎉</Text>
          <View style={styles.trialBannerContent}>
            <Text style={styles.trialBannerTitle}>Free Trial Active</Text>
            <Text style={styles.trialBannerText}>
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
            </Text>
          </View>
        </View>
      )}

      {/* Current Plan Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current Plan</Text>
        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <View>
              <View style={styles.tierRow}>
                <Text style={styles.tierName}>{displayInfo.tierName}</Text>
                <View
                  style={[
                    styles.tierBadge,
                    {backgroundColor: displayInfo.tierBadgeColor},
                  ]}>
                  <Text style={styles.tierBadgeText}>
                    {displayInfo.tierName.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {backgroundColor: displayInfo.statusColor},
                  ]}
                />
                <Text style={styles.statusText}>{displayInfo.statusText}</Text>
              </View>
            </View>
          </View>

          {/* Benefits */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Your Benefits:</Text>
            {displayInfo.benefits.map((benefit: string, index: number) => (
              <View key={index} style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Billing Info */}
          {subscription.tier !== 'free' && (
            <View style={styles.billingInfo}>
              <View style={styles.billingRow}>
                <Text style={styles.billingLabel}>Current Period:</Text>
                <Text style={styles.billingValue}>
                  {formatDate(subscription.currentPeriodStart)} -{' '}
                  {formatDate(subscription.currentPeriodEnd)}
                </Text>
              </View>
              {subscription.canceledAt && (
                <View style={styles.canceledInfo}>
                  <Text style={styles.canceledText}>
                    ⚠️ Subscription canceled on {formatDate(subscription.canceledAt)}
                  </Text>
                  <Text style={styles.canceledSubtext}>
                    You'll have access until {formatDate(subscription.currentPeriodEnd)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Usage Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Usage</Text>
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Households</Text>
            <Text style={styles.statValue}>
              {/* This would be fetched from actual data */}
              1 / {subscription.tier === 'premium' ? '∞' : '1'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Members per Household</Text>
            <Text style={styles.statValue}>
              {/* This would be fetched from actual data */}
              {subscription.tier === 'free'
                ? '0-2'
                : subscription.tier === 'standard'
                ? '0-4'
                : '0-12'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Ads</Text>
            <Text style={styles.statValue}>
              {subscription.tier === 'free'
                ? 'Enabled'
                : subscription.tier === 'standard'
                ? 'Admin: Off, Members: On'
                : 'Disabled'}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        {displayInfo.showUpgrade && (
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleViewPricing}>
            <Text style={styles.upgradeButtonText}>
              {subscription.tier === 'free'
                ? '🚀 Upgrade to Premium'
                : subscription.tier === 'standard'
                ? '⭐ Upgrade to Premium'
                : 'View All Plans'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.manageBillingButton}
          onPress={() => Alert.alert('Coming Soon', 'Billing management via Stripe')}>
          <Text style={styles.manageBillingButtonText}>Manage Billing</Text>
        </TouchableOpacity>

        {subscription.tier !== 'free' && !subscription.canceledAt && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
            disabled={canceling}>
            {canceling ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Help Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Need Help?</Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() =>
            Alert.alert(
              'Support',
              subscription.tier === 'premium'
                ? 'Priority support: support@linkshift.app'
                : 'Email us at: support@linkshift.app'
            )
          }>
          <Text style={styles.helpButtonText}>
            {subscription.tier === 'premium' ? '⚡ Priority Support' : '📧 Contact Support'}
          </Text>
        </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  trialBanner: {
    backgroundColor: '#F59E0B',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trialBannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  trialBannerContent: {
    flex: 1,
  },
  trialBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  trialBannerText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
  },
  planHeader: {
    marginBottom: 20,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: 12,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  benefitsContainer: {
    marginBottom: 20,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitIcon: {
    fontSize: 14,
    color: '#10B981',
    marginRight: 8,
    fontWeight: 'bold',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#D1D5DB',
  },
  billingInfo: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 16,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  billingLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  billingValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  canceledInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  canceledText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    marginBottom: 4,
  },
  canceledSubtext: {
    fontSize: 12,
    color: '#92400E',
  },
  statsCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
  },
  upgradeButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  manageBillingButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  manageBillingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  helpButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  helpButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
