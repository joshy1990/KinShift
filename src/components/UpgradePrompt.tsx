import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Modal} from 'react-native';

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title: string;
  message: string;
  currentLimit: number;
  upgradeToTier: 'standard' | 'premium';
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  visible,
  onClose,
  onUpgrade,
  title,
  message,
  currentLimit,
  upgradeToTier,
}) => {
  const tierColor = upgradeToTier === 'premium' ? '#F59E0B' : '#6366F1';
  const tierName = upgradeToTier === 'premium' ? 'Premium' : 'Standard';
  const tierPrice = upgradeToTier === 'premium' ? '£7.99/mo' : '£2.99/mo';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, {backgroundColor: tierColor}]}>
            <Text style={styles.headerIcon}>⚠️</Text>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>Current Limit:</Text>
              <Text style={styles.limitValue}>{currentLimit}</Text>
            </View>

            {/* Upgrade Info */}
            <View style={[styles.upgradeCard, {borderColor: tierColor}]}>
              <Text style={[styles.upgradeTier, {color: tierColor}]}>
                {tierName} Plan
              </Text>
              <Text style={styles.upgradePrice}>{tierPrice}</Text>
              <Text style={styles.upgradeFeature}>
                {upgradeToTier === 'premium'
                  ? '✓ Unlimited households\n✓ Up to 12 members\n✓ Completely ad-free\n✓ Priority support'
                  : '✓ Up to 4 members\n✓ Ad-free for admin\n✓ All features'}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.upgradeButton, {backgroundColor: tierColor}]}
              onPress={onUpgrade}
              activeOpacity={0.8}>
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    padding: 20,
  },
  message: {
    fontSize: 16,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  limitInfo: {
    backgroundColor: '#0F0F23',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  limitLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  limitValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  upgradeCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#0F0F23',
  },
  upgradeTier: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  upgradePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  upgradeFeature: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  upgradeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
