/**
 * Subscription Screen
 *
 * Thin wrapper that renders the RevenueCat Paywall (for free users) or
 * the Customer Center (for Pro users).
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useSubscription } from '@/contexts/SubscriptionContext';

export const SubscriptionScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { isPro, proStatus, restorePurchases, isLoading } = useSubscription();
  const [restoring, setRestoring] = useState(false);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </SafeAreaView>
    );
  }

  // Pro users → show status + manage link
  if (isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.proContent}>
          <Text style={styles.proIcon}>✓</Text>
          <Text style={styles.proTitle}>KinShift Pro</Text>
          <Text style={styles.proSubtitle}>
            You have access to all premium features.
          </Text>

          {proStatus.expirationDate && (
            <Text style={styles.expirationText}>
              {proStatus.willRenew ? 'Renews' : 'Expires'}:{' '}
              {proStatus.expirationDate.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          )}

          {proStatus.billingIssue && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>
                ⚠️ Billing issue detected — please update your payment method.
              </Text>
            </View>
          )}

          <View style={styles.benefits}>
            {['Unlimited households', 'Up to 12 members', 'Ad-free', 'Calendar export', 'Priority support'].map(
              (b) => (
                <View key={b} style={styles.benefitRow}>
                  <Text style={styles.benefitCheck}>✓</Text>
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ),
            )}
          </View>

          {navigation && (
            <TouchableOpacity
              style={styles.manageButton}
              onPress={() => navigation.navigate('CustomerCenter')}
            >
              <Text style={styles.manageButtonText}>Manage Subscription</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Free users → show RevenueCat Paywall
  return (
    <SafeAreaView style={styles.container}>
      <RevenueCatUI.Paywall
        onPurchaseCompleted={() => {
          Alert.alert('Welcome to Pro! 🎉', 'Enjoy all premium features.');
        }}
        onPurchaseError={(error) => {
          if (error.userCancelled) return;
          Alert.alert('Purchase Failed', error.message || 'Please try again.');
        }}
        onRestoreCompleted={() => {
          Alert.alert('Restored!', 'Your purchases have been restored.');
        }}
        onRestoreError={() => {
          Alert.alert('Restore Failed', 'No previous purchases found.');
        }}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={async () => {
            setRestoring(true);
            try {
              const ok = await restorePurchases();
              Alert.alert(
                ok ? 'Restored!' : 'No Purchases',
                ok ? 'Pro subscription restored.' : 'No previous purchases found.',
              );
            } catch {
              Alert.alert('Error', 'Failed to restore.');
            } finally {
              setRestoring(false);
            }
          }}
          disabled={restoring}
          style={styles.restoreButton}
        >
          {restoring ? (
            <ActivityIndicator size="small" color="#6366F1" />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F23' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  proContent: { padding: 32, alignItems: 'center' },
  proIcon: { fontSize: 64, color: '#10B981', marginBottom: 16 },
  proTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  proSubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginBottom: 12 },
  expirationText: { fontSize: 13, color: '#9CA3AF', marginBottom: 16 },
  warning: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, marginBottom: 16, width: '100%' },
  warningText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  benefits: { width: '100%', marginBottom: 24 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  benefitCheck: { fontSize: 16, color: '#10B981', marginRight: 12, fontWeight: 'bold' },
  benefitText: { fontSize: 14, color: '#D1D5DB' },
  manageButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  manageButtonText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },
  footer: { paddingHorizontal: 16, paddingBottom: 16 },
  restoreButton: { paddingVertical: 12, alignItems: 'center' },
  restoreText: { fontSize: 14, color: '#6366F1', fontWeight: '600' },
});
