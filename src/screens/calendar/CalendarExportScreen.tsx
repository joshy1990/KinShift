/**
 * Calendar Export Screen
 * Lets Premium users choose a date range and scope, then export shifts as .ics
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';
import { calendarExportService, ExportOptions } from '@/services/calendarExport.service';
import { colors, spacing, borderRadius } from '@/styles/theme';

type ExportScope = 'personal' | 'household';
type DateRangePreset = '7d' | '30d' | '90d' | '6m' | '1y' | 'custom';

const PRESETS: { key: DateRangePreset; label: string; days: number }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 3 months', days: 90 },
  { key: '6m', label: 'Last 6 months', days: 182 },
  { key: '1y', label: 'Last 12 months', days: 365 },
];

export const CalendarExportScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { currentTier } = useSubscription();
  const currentHouseholdId = useCurrentHouseholdId();

  const [scope, setScope] = useState<ExportScope>('personal');
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('30d');
  const [exporting, setExporting] = useState(false);

  const isPremium = currentTier === 'premium';

  const handleExport = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to export.');
      return;
    }

    if (!isPremium) {
      Alert.alert(
        'Premium Feature',
        'Calendar export is available on the Premium plan. Upgrade to export your shifts.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'View Plans', onPress: () => (navigation as any).navigate('PlanComparison') },
        ]
      );
      return;
    }

    if (scope === 'household' && !currentHouseholdId) {
      Alert.alert('No Household', 'Join or create a household to export household shifts.');
      return;
    }

    const preset = PRESETS.find(p => p.key === selectedPreset);
    if (!preset) return;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - preset.days);

    const options: ExportOptions = {
      scope,
      startDate,
      endDate,
      userId: user.id,
      householdId: scope === 'household' ? currentHouseholdId ?? undefined : undefined,
      calendarName: scope === 'household' ? 'KinShift Household' : 'KinShift Schedule',
    };

    setExporting(true);
    try {
      const result = await calendarExportService.exportShifts(options);

      if (result.success) {
        Alert.alert('Export Complete', `${result.shiftCount} shift${result.shiftCount !== 1 ? 's' : ''} exported successfully.`);
      } else if (result.error) {
        Alert.alert('Export Failed', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Something went wrong during export.');
    } finally {
      setExporting(false);
    }
  }, [user, isPremium, scope, selectedPreset, currentHouseholdId, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>📅</Text>
          <Text style={styles.title}>Export Calendar</Text>
          <Text style={styles.subtitle}>
            Export your shifts as an .ics file to import into Google Calendar, Apple Calendar, Outlook, or any other calendar app.
          </Text>
        </View>

        {/* Premium gate banner */}
        {!isPremium && (
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumIcon}>👑</Text>
            <View style={styles.premiumTextContainer}>
              <Text style={styles.premiumTitle}>Premium Feature</Text>
              <Text style={styles.premiumSubtitle}>
                Upgrade to Premium to export your shifts.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => (navigation as any).navigate('PlanComparison')}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scope selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to export</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, scope === 'personal' && styles.toggleButtonActive]}
              onPress={() => setScope('personal')}>
              <Text style={[styles.toggleText, scope === 'personal' && styles.toggleTextActive]}>
                My Shifts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                scope === 'household' && styles.toggleButtonActive,
                !currentHouseholdId && styles.toggleButtonDisabled,
              ]}
              onPress={() => currentHouseholdId && setScope('household')}
              disabled={!currentHouseholdId}>
              <Text
                style={[
                  styles.toggleText,
                  scope === 'household' && styles.toggleTextActive,
                  !currentHouseholdId && styles.toggleTextDisabled,
                ]}>
                Household
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date range selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date range</Text>
          {PRESETS.map(preset => (
            <TouchableOpacity
              key={preset.key}
              style={[
                styles.presetRow,
                selectedPreset === preset.key && styles.presetRowActive,
              ]}
              onPress={() => setSelectedPreset(preset.key)}>
              <View style={[styles.radio, selectedPreset === preset.key && styles.radioActive]}>
                {selectedPreset === preset.key && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.presetLabel, selectedPreset === preset.key && styles.presetLabelActive]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            The exported .ics file can be imported into Google Calendar, Apple Calendar, Microsoft Outlook, and most other calendar apps.
          </Text>
        </View>
      </ScrollView>

      {/* Export button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.exportButton, (!isPremium || exporting) && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={!isPremium || exporting}>
          {exporting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.exportButtonText}>
              {isPremium ? 'Export .ics File' : '👑 Upgrade to Export'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Premium banner
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  premiumIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F59E0B',
  },
  premiumSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  upgradeButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },

  // Sections
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Scope toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: borderRadius.sm - 2,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonDisabled: {
    opacity: 0.4,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.text,
  },
  toggleTextDisabled: {
    color: colors.textMuted,
  },

  // Date range presets
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetRowActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textMuted,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  presetLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  presetLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxxl : spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exportButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.5,
  },
  exportButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
});
