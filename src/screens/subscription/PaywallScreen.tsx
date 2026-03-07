/**
 * Paywall Screen
 *
 * Presents the RevenueCat remote paywall (configured in the RC dashboard).
 * Falls back to a simple "no offerings" message if the paywall can't load.
 *
 * Usage:
 *   navigation.navigate('Paywall')            — full screen
 *   navigation.navigate('Paywall', { offer }) — deep-link to a specific offer
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
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface PaywallScreenProps {
  navigation: any;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({ navigation }) => {
  const { isPro, restorePurchases } = useSubscription();
  const [restoring, setRestoring] = useState(false);

  // If user is already Pro, show a simple confirmation
  if (isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.proContainer}>
          <Text style={styles.proIcon}>✓</Text>
          <Text style={styles.proTitle}>You're a Pro member!</Text>
          <Text style={styles.proSubtitle}>
            You already have access to all premium features.
          </Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* RevenueCat Paywall — renders the remote paywall template */}
      <RevenueCatUI.Paywall
        onPurchaseCompleted={({ customerInfo }) => {
          Alert.alert(
            'Welcome to Pro! 🎉',
            'You now have access to all premium features.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        }}
        onPurchaseError={(error) => {
          // User cancelled is not a real error
          if (error.userCancelled) return;
          Alert.alert('Purchase Failed', error.message || 'Please try again.');
        }}
        onRestoreCompleted={({ customerInfo }) => {
          Alert.alert('Restored!', 'Your purchases have been restored.');
        }}
        onRestoreError={(error) => {
          Alert.alert('Restore Failed', error.message || 'No previous purchases found.');
        }}
        onDismiss={() => navigation.goBack()}
      />

      {/* Fallback restore button (always visible below paywall) */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={async () => {
            setRestoring(true);
            try {
              const restored = await restorePurchases();
              if (restored) {
                Alert.alert('Restored!', 'Your Pro subscription has been restored.');
                navigation.goBack();
              } else {
                Alert.alert('No Purchases', 'No previous purchases found.');
              }
            } catch {
              Alert.alert('Error', 'Failed to restore. Please try again.');
            } finally {
              setRestoring(false);
            }
          }}
          disabled={restoring}
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
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  proContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  proIcon: {
    fontSize: 64,
    color: '#10B981',
    marginBottom: 16,
  },
  proTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  proSubtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
});
