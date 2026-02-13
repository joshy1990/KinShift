import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarStackParamList } from '@/types';
import { addDays, format, startOfToday, startOfDay } from 'date-fns';
import { 
  detectShiftPattern, 
  quickPatternCheck,
  ShiftEntry,
  ShiftPattern,
  COMMON_PATTERNS 
} from '@/utils/shiftPatterns';
import { spacing, typography, borderRadius } from '@/utils/responsive';
import { shiftPatternService } from '@/services/shiftPattern.service';
import type { PatternTemplateKey } from '@/services/shiftPattern.service';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';

type Props = NativeStackScreenProps<CalendarStackParamList, 'AddShiftPattern'>;

export const AddShiftPatternScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const [currentStep, setCurrentStep] = useState<'choose' | 'input' | 'confirm'>('choose');
  const [selectedPattern, setSelectedPattern] = useState<ShiftPattern | null>(null);
  const [manualShifts, setManualShifts] = useState<ShiftEntry[]>([]);
  const [detectedPattern, setDetectedPattern] = useState<ShiftPattern | null>(null);
  const [currentDate, setCurrentDate] = useState(startOfToday());
  const [isApplying, setIsApplying] = useState(false);

  // Quick pattern feedback
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (manualShifts.length >= 2) {
      const feedback = quickPatternCheck(manualShifts);
      setQuickFeedback(feedback);
      
      if (manualShifts.length >= 6) {
        const detected = detectShiftPattern(manualShifts);
        if (detected) {
          setDetectedPattern(detected.pattern);
        }
      }
    }
  }, [manualShifts]);

  const addManualShift = (type: 'day' | 'night' | 'off', dayOffset: number = 0) => {
    const date = addDays(currentDate, dayOffset);
    const newShift: ShiftEntry = {
      date,
      type,
      startTime: type === 'day' ? '08:00' : type === 'night' ? '20:00' : undefined,
      endTime: type === 'day' ? '18:00' : type === 'night' ? '06:00' : undefined,
      title: type === 'off' ? 'Off' : `${type === 'day' ? 'Day' : 'Night'} Shift`
    };
    
    setManualShifts(prev => {
      const filtered = prev.filter(s => !isSameDate(s.date, date));
      return [...filtered, newShift].sort((a, b) => a.date.getTime() - b.date.getTime());
    });
  };

  const isSameDate = (date1: Date, date2: Date) => {
    return format(date1, 'yyyy-MM-dd') === format(date2, 'yyyy-MM-dd');
  };

  const handlePatternSelection = (pattern: ShiftPattern) => {
    setSelectedPattern(pattern);
    setCurrentStep('confirm');
  };

  const confirmPattern = async () => {
    const pattern = selectedPattern || detectedPattern;
    if (!pattern || !user) return;

    setIsApplying(true);
    try {
      // Determine pattern key — use id if it matches a template, else use 'custom'
      const patternKey = (pattern.id || 'custom') as PatternTemplateKey | 'custom';
      const firstShift = pattern.cycle?.[0];

      const result = await shiftPatternService.generateShiftsFromPattern({
        patternKey,
        startDate: startOfDay(new Date()),
        shiftStartTime: firstShift?.startTime || '09:00',
        shiftEndTime: firstShift?.endTime || '17:00',
        title: pattern.name || 'Shift',
        householdId: currentHouseholdId || undefined,
        ownerId: user.id,
        shiftType: firstShift?.type === 'night' ? 'night' : 'day',
        durationMonths: 12,
      });

      if (result.success) {
        Alert.alert(
          'Pattern Applied!',
          `Created ${result.created} shifts for your ${pattern.name} pattern over the next year.`,
          [{ text: 'Great!', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'Partial Success',
          `Created ${result.created} shifts with ${result.failed} failures.\n${result.errors.join('\n')}`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to apply pattern. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const renderChooseMethod = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Your Work Pattern</Text>
        <Text style={styles.subtitle}>Choose how you'd like to set up your shifts</Text>
      </View>

      <View style={styles.methodCards}>
        <TouchableOpacity 
          style={styles.methodCard}
          onPress={() => setCurrentStep('input')}>
          <Text style={styles.methodIcon}>✏️</Text>
          <Text style={styles.methodTitle}>Enter My Pattern</Text>
          <Text style={styles.methodDesc}>Add a few shifts and we'll detect your pattern</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or choose a common pattern</Text>
          <View style={styles.dividerLine} />
        </View>

        {Object.entries(COMMON_PATTERNS).map(([key, pattern]) => (
          <TouchableOpacity 
            key={key}
            style={styles.patternCard}
            onPress={() => handlePatternSelection({
              id: key,
              name: pattern.name,
              description: pattern.description,
              cycle: pattern.cycle.map((shift, index) => ({
                ...shift,
                date: addDays(new Date(), index)
              })) as ShiftEntry[],
              cycleDays: pattern.cycleDays,
              confidence: 0.9
            })}>
            <Text style={styles.patternName}>{pattern.name}</Text>
            <Text style={styles.patternDesc}>{pattern.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPatternInput = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentStep('choose')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Enter Your Pattern</Text>
        <Text style={styles.subtitle}>Add your shifts for the next 7-10 days</Text>
      </View>

      {quickFeedback && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackIcon}>🎯</Text>
          <Text style={styles.feedbackText}>{quickFeedback}</Text>
        </View>
      )}

      <ScrollView style={styles.inputSection}>
        <Text style={styles.sectionTitle}>Next 10 Days</Text>
        
        {Array.from({ length: 10 }, (_, i) => {
          const date = addDays(currentDate, i);
          const existingShift = manualShifts.find(s => isSameDate(s.date, date));
          
          return (
            <View key={i} style={styles.dayRow}>
              <View style={styles.dayInfo}>
                <Text style={styles.dayName}>{format(date, 'EEE')}</Text>
                <Text style={styles.dayDate}>{format(date, 'MMM d')}</Text>
              </View>
              
              <View style={styles.shiftButtons}>
                <TouchableOpacity
                  style={[
                    styles.shiftButton,
                    existingShift?.type === 'day' && styles.selectedButton
                  ]}
                  onPress={() => addManualShift('day', i)}>
                  <Text style={[
                    styles.shiftButtonText,
                    existingShift?.type === 'day' && styles.selectedButtonText
                  ]}>Day</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.shiftButton,
                    existingShift?.type === 'night' && styles.selectedButton
                  ]}
                  onPress={() => addManualShift('night', i)}>
                  <Text style={[
                    styles.shiftButtonText,
                    existingShift?.type === 'night' && styles.selectedButtonText
                  ]}>Night</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.shiftButton,
                    existingShift?.type === 'off' && styles.selectedButton
                  ]}
                  onPress={() => addManualShift('off', i)}>
                  <Text style={[
                    styles.shiftButtonText,
                    existingShift?.type === 'off' && styles.selectedButtonText
                  ]}>Off</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {detectedPattern && (
        <View style={styles.detectedSection}>
          <Text style={styles.detectedTitle}>✨ Pattern Detected!</Text>
          <Text style={styles.detectedName}>{detectedPattern.name}</Text>
          <Text style={styles.detectedDesc}>{detectedPattern.description}</Text>
          
          <TouchableOpacity 
            style={styles.usePatternButton}
            onPress={() => {
              setSelectedPattern(detectedPattern);
              setCurrentStep('confirm');
            }}>
            <Text style={styles.usePatternButtonText}>Use This Pattern</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCurrentStep(selectedPattern?.id.startsWith('detected') ? 'input' : 'choose')}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Your Pattern</Text>
      </View>

      <View style={styles.confirmCard}>
        <Text style={styles.confirmIcon}>🎯</Text>
        <Text style={styles.confirmPatternName}>{selectedPattern?.name}</Text>
        <Text style={styles.confirmPatternDesc}>{selectedPattern?.description}</Text>
        
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>Preview (Next 2 Weeks)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.previewRow}>
              {Array.from({ length: 14 }, (_, i) => {
                const date = addDays(currentDate, i);
                const cyclePosition = i % (selectedPattern?.cycleDays || 1);
                const shift = selectedPattern?.cycle[cyclePosition];
                
                return (
                  <View key={i} style={styles.previewDay}>
                    <Text style={styles.previewDate}>{format(date, 'MMM d')}</Text>
                    <View style={[
                      styles.previewShift,
                      shift?.type === 'day' && styles.dayShift,
                      shift?.type === 'night' && styles.nightShift,
                      shift?.type === 'off' && styles.offShift,
                    ]}>
                      <Text style={styles.previewShiftText}>
                        {shift?.type === 'day' ? 'D' : shift?.type === 'night' ? 'N' : '-'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View style={styles.confirmActions}>
          <TouchableOpacity style={styles.confirmButton} onPress={confirmPattern}>
            <Text style={styles.confirmButtonText}>Add Pattern for Full Year</Text>
          </TouchableOpacity>
          <Text style={styles.confirmNote}>This will add your shifts for the next 12 months</Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.screen}>
      {currentStep === 'choose' && renderChooseMethod()}
      {currentStep === 'input' && renderPatternInput()}
      {currentStep === 'confirm' && renderConfirmation()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  backButton: {
    color: '#6366F1',
    fontSize: typography.body,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.body,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  methodCards: {
    gap: spacing.md,
  },
  methodCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  methodIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  methodTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  methodDesc: {
    fontSize: typography.body,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: '#6B7280',
    fontSize: typography.caption,
    marginHorizontal: spacing.md,
  },
  patternCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  patternName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  patternDesc: {
    fontSize: typography.caption,
    color: '#A1A1AA',
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  feedbackIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  feedbackText: {
    flex: 1,
    color: '#22C55E',
    fontSize: typography.body,
    fontWeight: '600',
  },
  inputSection: {
    flex: 1,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  dayInfo: {
    width: 80,
  },
  dayName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dayDate: {
    fontSize: typography.caption,
    color: '#A1A1AA',
  },
  shiftButtons: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shiftButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#6366F1',
  },
  shiftButtonText: {
    fontSize: typography.caption,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  selectedButtonText: {
    color: '#FFFFFF',
  },
  detectedSection: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  detectedTitle: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: spacing.sm,
  },
  detectedName: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  detectedDesc: {
    fontSize: typography.caption,
    color: '#A1A1AA',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  usePatternButton: {
    backgroundColor: '#6366F1',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  usePatternButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '700',
  },
  confirmCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  confirmIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  confirmPatternName: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  confirmPatternDesc: {
    fontSize: typography.body,
    color: '#A1A1AA',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  previewSection: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  previewTitle: {
    fontSize: typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  previewDay: {
    alignItems: 'center',
    minWidth: 50,
  },
  previewDate: {
    fontSize: typography.caption,
    color: '#A1A1AA',
    marginBottom: spacing.xs,
  },
  previewShift: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayShift: {
    backgroundColor: '#F59E0B',
  },
  nightShift: {
    backgroundColor: '#6366F1',
  },
  offShift: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewShiftText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmActions: {
    width: '100%',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#22C55E',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '700',
  },
  confirmNote: {
    fontSize: typography.caption,
    color: '#6B7280',
    textAlign: 'center',
  },
});