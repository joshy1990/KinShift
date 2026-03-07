/**
 * Customer Center Screen
 *
 * Presents the RevenueCat Customer Center for subscription management —
 * change plan, request cancellation, check billing status, etc.
 *
 * This uses the native RevenueCat Customer Center UI which is configured
 * in the RevenueCat dashboard.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';
import _RevenueCatUI from 'react-native-purchases-ui';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface CustomerCenterScreenProps {
  navigation: any;
}

export const CustomerCenterScreen: React.FC<CustomerCenterScreenProps> = ({ navigation }) => {
  const { isPro, proStatus, tier: _tier, restorePurchases } = useSubscription();
  const [loading, setLoading] = useState(false);

  const openStoreSubscriptionSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    } else {
      Alert.alert(
        'Manage Subscription',
        'Please manage your subscription through the App Store (iOS) or Google Play Store (Android).',
      );
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert('Restored!', 'Your subscription has been restored.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found.');
      }
    } catch {
      Alert.alert('Error', 'Failed to restore purchases.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Current Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          <View style={styles.planCard}>
            <View style={styles.planRow}>
              <Text style={styles.planName}>
                {isPro ? 'KinShift Pro' : 'Free'}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: isPro ? '#F59E0B' : '#6B7280' },
                ]}
              >
                <Text style={styles.badgeText}>
                  {isPro ? 'PRO' : 'FREE'}
                </Text>
              </View>
            </View>

            {isPro && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Renews</Text>
                  <Text style={styles.infoValue}>
                    {proStatus.willRenew
                      ? formatDate(proStatus.expirationDate)
                      : 'Will not renew'}
                  </Text>
                </View>

                {proStatus.billingIssue && (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                      ⚠️ Billing issue detected. Please update your payment method.
                    </Text>
                  </View>
                )}

                {!proStatus.willRenew && (
                  <View style={styles.warningBanner}>
                    <Text style={styles.warningText}>
                      Your subscription won't renew. You'll lose Pro features on{' '}
                      {formatDate(proStatus.expirationDate)}.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isPro ? 'Your Pro Benefits' : 'Free Plan'}
          </Text>
          <View style={styles.benefitsCard}>
            {isPro ? (
              <>
                <BenefitRow icon="✓" text="Unlimited households" />
                <BenefitRow icon="✓" text="Up to 12 members per household" />
                <BenefitRow icon="✓" text="Ad-free experience" />
                <BenefitRow icon="✓" text="Calendar export" />
                <BenefitRow icon="✓" text="Priority support" />
              </>
            ) : (
              <>
                <BenefitRow icon="✓" text="1 household" />
                <BenefitRow icon="✓" text="Up to 2 members" />
                <BenefitRow icon="✓" text="Unlimited shifts & notes" />
                <BenefitRow icon="✓" text="All core features" />
              </>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {!isPro && (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Text style={styles.upgradeButtonText}>🚀 Upgrade to Pro</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={openStoreSubscriptionSettings}
          >
            <Text style={styles.actionButtonText}>Manage Billing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRestore}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#9CA3AF" />
            ) : (
              <Text style={styles.actionButtonText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              Alert.alert(
                'Support',
                isPro
                  ? 'Priority support: support@offeryn.co.uk'
                  : 'Email us at: support@offeryn.co.uk',
              )
            }
          >
            <Text style={styles.actionButtonText}>
              {isPro ? '⚡ Priority Support' : '📧 Contact Support'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const BenefitRow: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.benefitRow}>
    <Text style={styles.benefitIcon}>{icon}</Text>
    <Text style={styles.benefitText}>{text}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
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
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  infoLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  warningBanner: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
  benefitsCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  benefitIcon: {
    fontSize: 16,
    color: '#10B981',
    marginRight: 12,
    fontWeight: 'bold',
  },
  benefitText: {
    fontSize: 14,
    color: '#D1D5DB',
    flex: 1,
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
  actionButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
});
