import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

interface TrialCountdownBannerProps {
  daysRemaining: number;
  onUpgrade: () => void;
}

export const TrialCountdownBanner: React.FC<TrialCountdownBannerProps> = ({
  daysRemaining,
  onUpgrade,
}) => {
  const isUrgent = daysRemaining <= 3;

  return (
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{isUrgent ? '⏰' : '🎉'}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isUrgent ? 'Trial Ending Soon!' : 'Free Trial Active'}
          </Text>
          <Text style={styles.subtitle}>
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
          </Text>
        </View>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={onUpgrade}
          activeOpacity={0.8}>
          <Text style={styles.upgradeButtonText}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface MemberLimitWarningProps {
  currentMembers: number;
  maxMembers: number;
  onUpgrade: () => void;
}

export const MemberLimitWarning: React.FC<MemberLimitWarningProps> = ({
  currentMembers,
  maxMembers,
  onUpgrade,
}) => {
  const percentage = (currentMembers / maxMembers) * 100;
  const isAtLimit = currentMembers >= maxMembers;
  const isNearLimit = percentage >= 80;

  if (!isNearLimit && !isAtLimit) {
    return null;
  }

  return (
    <View style={[styles.warningContainer, isAtLimit && styles.warningContainerDanger]}>
      <View style={styles.warningContent}>
        <Text style={styles.warningIcon}>{isAtLimit ? '🚫' : '⚠️'}</Text>
        <View style={styles.warningTextContainer}>
          <Text style={styles.warningTitle}>
            {isAtLimit ? 'Member Limit Reached' : 'Almost at Limit'}
          </Text>
          <Text style={styles.warningSubtitle}>
            {currentMembers} / {maxMembers} members
          </Text>
        </View>
        <TouchableOpacity
          style={styles.warningUpgradeButton}
          onPress={onUpgrade}
          activeOpacity={0.8}>
          <Text style={styles.warningUpgradeButtonText}>Upgrade</Text>
        </TouchableOpacity>
      </View>
      {isAtLimit && (
        <Text style={styles.warningDescription}>
          You need to upgrade to add more members to this household
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Trial Countdown Banner
  container: {
    backgroundColor: '#F59E0B',
    padding: 16,
  },
  containerUrgent: {
    backgroundColor: '#EF4444',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  upgradeButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
  },

  // Member Limit Warning
  warningContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  warningContainerDanger: {
    backgroundColor: '#FEE2E2',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 2,
  },
  warningSubtitle: {
    fontSize: 12,
    color: '#92400E',
  },
  warningUpgradeButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  warningUpgradeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  warningDescription: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 8,
    paddingLeft: 36,
  },
});
