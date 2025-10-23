/**
 * Subscription Screen
 * Displays subscription plans and handles purchases with smooth animations
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { revenueCatService } from '@/services/revenueCat.service';

export const SubscriptionScreen: React.FC = () => {
  const subscription = useSubscription();
  const [offerings, setOfferings] = useState<any[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const successFade = useRef(new Animated.Value(0)).current;

  // Load offerings on mount
  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    loadOfferings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOfferings = async () => {
    try {
      const packages = await revenueCatService.getOfferings();
      setOfferings(packages);

      // Auto-select first package
      if (packages.length > 0 && !selectedPackageId) {
        setSelectedPackageId(packages[0].identifier);
      }
    } catch (error) {
      console.error('[SubscriptionScreen] Failed to load offerings:', error);
      Alert.alert('Error', 'Failed to load subscription plans. Please try again.');
    }
  };

  const handlePurchase = useCallback(async () => {
    if (!selectedPackageId) {
      Alert.alert('Error', 'Please select a plan');
      return;
    }

    try {
      setPurchasing(true);

      const success = await subscription.purchaseSubscription(selectedPackageId);

      if (success) {
        // Show success message with animation
        setSuccessMessage('🎉 Welcome to Premium!');
        Animated.sequence([
          Animated.timing(successFade, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
          Animated.timing(successFade, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => setSuccessMessage(null));

        Alert.alert('Success', 'Subscription activated! Enjoy premium features.');
      } else {
        Alert.alert('Cancelled', 'Purchase was cancelled.');
      }
    } catch (error) {
      console.error('[SubscriptionScreen] Purchase error:', error);
      Alert.alert('Error', 'Failed to complete purchase. Please try again.');
    } finally {
      setPurchasing(false);
    }
  }, [selectedPackageId, subscription, successFade]);

  const handleRestore = async () => {
    try {
      setRestoring(true);

      const success = await subscription.restorePurchases();

      if (success) {
        Alert.alert('Success', 'Purchases restored successfully.');
      } else {
        Alert.alert('No Purchases', 'No previous purchases found.');
      }
    } catch (error) {
      console.error('[SubscriptionScreen] Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(price);
  };

  if (subscription.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  const currentPackage = offerings.find((p) => p.identifier === selectedPackageId);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {/* Success Message */}
        {successMessage && (
          <Animated.View
            style={[
              styles.successBanner,
              {
                opacity: successFade,
              },
            ]}
          >
            <Text style={styles.successText}>{successMessage}</Text>
          </Animated.View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.title}>Premium Features</Text>
          <Text style={styles.subtitle}>Unlock powerful shift management tools</Text>
        </View>

        {/* Current Tier Badge */}
        {subscription.hasActiveSubscription && (
          <View style={styles.tierBadge}>
            <Text style={styles.tierIcon}>✓</Text>
            <Text style={styles.tierText}>
              {subscription.currentTier === 'premium' ? 'Premium Active' : 'Standard Active'}
            </Text>
            {subscription.expirationDate && (
              <Text style={styles.expirationText}>
                Expires: {subscription.expirationDate.toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {/* Plans Carousel */}
        <View style={styles.plansContainer}>
          {offerings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No plans available</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadOfferings}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            offerings.map((offering) => (
              <TouchableOpacity
                key={offering.identifier}
                style={[
                  styles.planCard,
                  selectedPackageId === offering.identifier && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPackageId(offering.identifier)}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{offering.identifier.split('_').pop()?.toUpperCase()}</Text>
                  {offering.identifier.includes('premium') && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>POPULAR</Text>
                    </View>
                  )}
                </View>

                <View style={styles.priceContainer}>
                  <Text style={styles.price}>
                    {offering.currentPrice ? formatPrice(offering.currentPrice, offering.currencyCode) : 'Free'}
                  </Text>
                  {offering.introPrice && (
                    <Text style={styles.introPrice}>First {offering.introPricePeriod}</Text>
                  )}
                </View>

                <View style={styles.featuresList}>
                  {getTierFeatures(offering.identifier).map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Text style={styles.featureIcon}>
                        {feature.included ? '✓' : '✗'}
                      </Text>
                      <Text
                        style={[
                          styles.featureText,
                          !feature.included && styles.featureTextDisabled,
                        ]}
                      >
                        {feature.name}
                      </Text>
                    </View>
                  ))}
                </View>

                {selectedPackageId === offering.identifier && (
                  <Text style={styles.checkmarkEmoji}>✓</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Features Comparison */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>What's Included</Text>
          <View style={styles.comparisonTable}>
            {getComparisonFeatures().map((feature, idx) => (
              <View key={idx} style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>{feature}</Text>
                <View style={styles.comparisonTiers}>
                  <View style={styles.comparisonTier}>
                    <Text style={[
                      styles.comparisonCheck,
                      getFreeFeatures().includes(feature) ? styles.checkGreen : styles.checkGray
                    ]}>
                      {getFreeFeatures().includes(feature) ? '✓' : '✗'}
                    </Text>
                  </View>
                  <View style={styles.comparisonTier}>
                    <Text style={[
                      styles.comparisonCheck,
                      getStandardFeatures().includes(feature) ? styles.checkGreen : styles.checkGray
                    ]}>
                      {getStandardFeatures().includes(feature) ? '✓' : '✗'}
                    </Text>
                  </View>
                  <View style={styles.comparisonTier}>
                    <Text style={[
                      styles.comparisonCheck,
                      getPremiumFeatures().includes(feature) ? styles.checkGreen : styles.checkGray
                    ]}>
                      {getPremiumFeatures().includes(feature) ? '✓' : '✗'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Terms */}
        <Text style={styles.termsText}>
          Subscription will auto-renew. Manage your subscription in{' '}
          <Text
            style={styles.settingsLink}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openURL('market://details?id=com.kinshift.app');
              }
            }}
          >
            Settings
          </Text>
          .
        </Text>

        {/* Footer with action buttons */}
        <View style={styles.footer}>
        {!subscription.hasActiveSubscription && (
          <TouchableOpacity
            style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
            onPress={handlePurchase}
            disabled={purchasing || offerings.length === 0}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                Subscribe Now
                {currentPackage && currentPackage.currentPrice
                  ? ` - ${formatPrice(currentPackage.currentPrice, currentPackage.currencyCode)}`
                  : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.restoreButton, restoring && styles.restoreButtonDisabled]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#007AFF" />
          ) : (
            <Text style={styles.restoreButtonText}>Restore Purchase</Text>
          )}
        </TouchableOpacity>
      </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

// Helper functions
const getTierFeatures = (tierId: string): Array<{ name: string; included: boolean }> => {
  const baseFeatures = [
    { name: 'View schedule', included: true },
    { name: 'Basic shifts', included: true },
  { name: 'Limited households', included: tierId !== 'kinshift_free' },
  ];

  if (tierId.includes('standard')) {
    return [
      ...baseFeatures,
      { name: 'Up to 4 members', included: true },
      { name: 'Shift patterns', included: true },
      { name: 'Email notifications', included: true },
    ];
  }

  if (tierId.includes('premium')) {
    return [
      ...baseFeatures,
      { name: 'Up to 12 members', included: true },
      { name: 'Shift patterns', included: true },
      { name: 'Push notifications', included: true },
      { name: 'No ads', included: true },
      { name: 'Priority support', included: true },
    ];
  }

  return [
    { name: 'View schedule', included: true },
    { name: 'Basic shifts', included: true },
    { name: '1 household', included: true },
    { name: '2 members', included: true },
  ];
};

const getFreeFeatures = () => [
  'View schedule',
  'Basic shifts',
  'Email support',
];

const getStandardFeatures = () => [
  'View schedule',
  'Basic shifts',
  'Shift patterns',
  'Push notifications',
  'Email support',
  'Up to 4 members',
];

const getPremiumFeatures = () => [
  'View schedule',
  'Basic shifts',
  'Shift patterns',
  'Push notifications',
  'Email support',
  'Up to 12 members',
  'No ads',
  'Priority support',
];

const getComparisonFeatures = () => [
  'View schedule',
  'Basic shifts',
  'Shift patterns',
  'Households',
  'Members per household',
  'Push notifications',
  'No ads',
  'Priority support',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBanner: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  successText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  crown: {
    fontSize: 48,
    marginBottom: 12,
  },
  tierIcon: {
    fontSize: 16,
    color: '#4CAF50',
    marginRight: 8,
  },
  featureIcon: {
    fontSize: 14,
    marginRight: 8,
    fontWeight: '700',
  },
  checkmarkEmoji: {
    position: 'absolute',
    top: 12,
    right: 12,
    fontSize: 20,
    color: '#007AFF',
  },
  comparisonCheck: {
    fontSize: 14,
    fontWeight: '700',
  },
  checkGreen: {
    color: '#4CAF50',
  },
  checkGray: {
    color: '#CCC',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 8,
    flex: 1,
  },
  expirationText: {
    fontSize: 12,
    color: '#558B2F',
  },
  plansContainer: {
    marginBottom: 32,
  },
  planCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  popularBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  priceContainer: {
    marginBottom: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  introPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  featuresList: {
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  featureText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  featureTextDisabled: {
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  comparisonSection: {
    marginBottom: 32,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 16,
  },
  comparisonTable: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  comparisonRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  comparisonLabel: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  comparisonTiers: {
    flexDirection: 'row',
    gap: 8,
  },
  comparisonTier: {
    width: 40,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  settingsLink: {
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  purchaseButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
