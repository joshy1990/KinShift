import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarStackParamList, ShiftType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';
import { customPatternService, PatternCell } from '@/services/customPattern.service';
import { SHIFT_TYPE_COLORS } from '@/utils/shiftColors';
import { spacing, borderRadius } from '@/utils/responsive';

type Props = NativeStackScreenProps<CalendarStackParamList, 'PatternBuilder'>;

const SHIFT_TYPES: Array<{ type: ShiftType | null; label: string; emoji: string; defaultStart: string; defaultEnd: string }> = [
  { type: 'day', label: 'Day Shift', emoji: '☀️', defaultStart: '08:00', defaultEnd: '16:00' },
  { type: 'night', label: 'Night Shift', emoji: '🌙', defaultStart: '20:00', defaultEnd: '06:00' },
  { type: 'twilight', label: 'Twilight', emoji: '🌆', defaultStart: '14:00', defaultEnd: '22:00' },
  { type: 'split', label: 'Split Shift', emoji: '⚡', defaultStart: '09:00', defaultEnd: '17:00' },
  { type: 'training', label: 'Training', emoji: '📚', defaultStart: '09:00', defaultEnd: '17:00' },
  { type: 'holiday', label: 'Holiday', emoji: '🎉', defaultStart: '00:00', defaultEnd: '23:59' },
  { type: 'sick', label: 'Sick Day', emoji: '🤒', defaultStart: '00:00', defaultEnd: '23:59' },
  { type: null, label: 'Day Off', emoji: '🏖️', defaultStart: '00:00', defaultEnd: '00:00' },
];

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const PatternBuilderScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  
  const [patternName, setPatternName] = useState('');
  const [patternMode, setPatternMode] = useState<'weekly' | 'repetition'>('weekly');
  const [cells, setCells] = useState<PatternCell[]>(
    Array(14).fill(null).map((_, i) => ({
      day: i + 1,
      shiftType: null,
      startTime: '09:00',
      endTime: '17:00',
    }))
  );
  
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showShiftPicker, setShowShiftPicker] = useState(false);
  const [tempStartTime, setTempStartTime] = useState('09:00');
  const [tempEndTime, setTempEndTime] = useState('17:00');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Please log in to create patterns</Text>
      </SafeAreaView>
    );
  }

  /**
   * When pattern mode changes, auto-populate cells intelligently
   */
  const handlePatternModeChange = (mode: 'weekly' | 'repetition') => {
    setPatternMode(mode);
    
    if (mode === 'weekly') {
      // Fill Week 2 to match Week 1 (repeat the 7-day pattern)
      const newCells = [...cells];
      for (let i = 0; i < 7; i++) {
        newCells[7 + i] = { 
          ...newCells[i],
          day: 8 + i // Ensure correct day numbering for Week 2 (8-14)
        };
      }
      setCells(newCells);
    }
    // For 'repetition' mode, keep as-is - user will define custom cycle
  };

  const handleCellTap = (day: number) => {
    setSelectedDay(day);
    const cell = cells[day - 1];
    setTempStartTime(cell.startTime);
    setTempEndTime(cell.endTime);
    setShowShiftPicker(true);
  };

  const handleSelectShift = (shiftType: ShiftType | null, defaultStart: string, defaultEnd: string) => {
    if (selectedDay === null) return;

    const newCells = [...cells];
    newCells[selectedDay - 1] = {
      day: selectedDay,
      shiftType: shiftType,
      startTime: defaultStart,
      endTime: defaultEnd,
    };
    // In weekly mode, mirror Week 1 changes to Week 2
    if (patternMode === 'weekly' && selectedDay <= 7) {
      newCells[selectedDay + 6] = {
        day: selectedDay + 7,
        shiftType: shiftType,
        startTime: defaultStart,
        endTime: defaultEnd,
      };
    }
    setCells(newCells);
    setTempStartTime(defaultStart);
    setTempEndTime(defaultEnd);
  };

  const handleSaveCell = () => {
    if (selectedDay === null) return;

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(tempStartTime) || !timeRegex.test(tempEndTime)) {
      Alert.alert('Invalid Time', 'Please use HH:mm format (e.g., 09:00)');
      return;
    }

    const newCells = [...cells];
    newCells[selectedDay - 1] = {
      ...newCells[selectedDay - 1],
      startTime: tempStartTime,
      endTime: tempEndTime,
    };
    // In weekly mode, mirror Week 1 time changes to Week 2
    if (patternMode === 'weekly' && selectedDay <= 7) {
      newCells[selectedDay + 6] = {
        ...newCells[selectedDay + 6],
        startTime: tempStartTime,
        endTime: tempEndTime,
      };
    }
    setCells(newCells);
    setShowShiftPicker(false);
    setSelectedDay(null);
  };

  const handleClearCell = () => {
    if (selectedDay === null) return;

    const newCells = [...cells];
    newCells[selectedDay - 1] = {
      day: selectedDay,
      shiftType: null,
      startTime: '09:00',
      endTime: '17:00',
    };
    setCells(newCells);
    setShowShiftPicker(false);
    setSelectedDay(null);
  };

  const handleSavePattern = async () => {
    // Validate pattern name
    if (!patternName.trim()) {
      Alert.alert('Pattern Name Required', 'Please enter a name for your pattern');
      return;
    }

    // Validate at least one working day
    const hasWorkingDay = cells.some(cell => cell.shiftType !== null);
    if (!hasWorkingDay) {
      Alert.alert('No Working Days', 'Your pattern must have at least one working day');
      return;
    }

    setSaving(true);
    try {
      const savedPatternId = await customPatternService.savePattern(
        user.id,
        patternName.trim(),
        cells,
        currentHouseholdId,
        undefined, // description
        patternMode // Pass the current mode!
      );

      // Load the saved pattern to pass as object for pre-selection
      const savedPattern = await customPatternService.getPattern(savedPatternId);

      // Navigate back to AddShift with the newly created pattern pre-selected
      navigation.navigate('AddShift', {
        date: new Date(), // Pass current date (will be hidden for custom patterns)
        preSelectPattern: savedPattern || { id: savedPatternId, name: patternName.trim() }, // Pass the pattern object
      });
    } catch (error) {
      console.error('Failed to save pattern:', error);
      Alert.alert('Save Failed', 'Could not save pattern. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (cell: PatternCell) => {
    const dayOfWeek = DAY_NAMES[(cell.day - 1) % 7];
    const weekNumber = Math.floor((cell.day - 1) / 7) + 1;

    return (
      <TouchableOpacity
        key={cell.day}
        style={[
          styles.cell,
          cell.shiftType && { backgroundColor: SHIFT_TYPE_COLORS[cell.shiftType] + '40' }, // 40 = 25% opacity
        ]}
        onPress={() => handleCellTap(cell.day)}
      >
        <Text style={styles.dayNumber}>{cell.day}</Text>
        <Text style={styles.dayName}>{dayOfWeek}</Text>
        {cell.shiftType ? (
          <>
            <Text style={styles.shiftEmoji}>
              {SHIFT_TYPES.find(s => s.type === cell.shiftType)?.emoji || '📅'}
            </Text>
            <Text style={styles.shiftTime}>{cell.startTime}</Text>
            <Text style={styles.shiftTime}>{cell.endTime}</Text>
          </>
        ) : (
          <Text style={styles.offLabel}>OFF</Text>
        )}
      </TouchableOpacity>
    );
  };

  const workingDaysCount = cells.filter(c => c.shiftType !== null).length;
  const offDaysCount = 14 - workingDaysCount;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Custom Pattern</Text>
          <Text style={styles.subtitle}>Design your 14-day shift pattern</Text>
        </View>

        {/* Pattern Mode Toggle */}
        <View style={styles.modeSection}>
          <Text style={styles.label}>Pattern Type</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeButton, patternMode === 'weekly' && styles.modeButtonActive]}
              onPress={() => handlePatternModeChange('weekly')}
            >
              <Text style={[styles.modeButtonText, patternMode === 'weekly' && styles.modeButtonTextActive]}>
                📅 Weekly
              </Text>
              <Text style={[styles.modeButtonSubtext, patternMode === 'weekly' && styles.modeButtonSubtextActive]}>
                Mon-Sun repeats
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modeButton, patternMode === 'repetition' && styles.modeButtonActive]}
              onPress={() => handlePatternModeChange('repetition')}
            >
              <Text style={[styles.modeButtonText, patternMode === 'repetition' && styles.modeButtonTextActive]}>
                🔄 Repetition
              </Text>
              <Text style={[styles.modeButtonSubtext, patternMode === 'repetition' && styles.modeButtonSubtextActive]}>
                Custom cycle
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeHelpText}>
            {patternMode === 'weekly'
              ? '📌 Same shifts repeat every week (e.g., always work Mon-Fri)'
              : '🔁 Define custom work/off cycles (e.g., 4 days on, 4 days off)'}
          </Text>
        </View>

        {/* Pattern Name Input */}
        <View style={styles.nameSection}>
          <Text style={styles.label}>Pattern Name</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="e.g., My 2D2N Pattern"
            value={patternName}
            onChangeText={setPatternName}
            maxLength={50}
          />
        </View>

        {/* Week 1 - Always show */}
        <View style={styles.weekSection}>
          <Text style={styles.weekTitle}>Week 1</Text>
          <View style={styles.weekGrid}>
            {cells.slice(0, 7).map(renderCell)}
          </View>
        </View>

        {/* Week 2 - Only show in Repetition mode */}
        {patternMode === 'repetition' && (
          <View style={styles.weekSection}>
            <Text style={styles.weekTitle}>Week 2</Text>
            <View style={styles.weekGrid}>
              {cells.slice(7, 14).map(renderCell)}
            </View>
          </View>
        )}

        {/* Pattern Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Pattern Summary</Text>
          <Text style={styles.summaryText}>
            ✅ {workingDaysCount} working days
          </Text>
          <Text style={styles.summaryText}>
            🏖️ {offDaysCount} days off
          </Text>
          <Text style={styles.helpText}>
            Tap any cell to add or edit a shift
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={handleSavePattern}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Pattern'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Shift Picker Modal */}
      <Modal
        visible={showShiftPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShiftPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select Shift for Day {selectedDay}
            </Text>

            <ScrollView style={styles.shiftTypeList}>
              {SHIFT_TYPES.map((shift) => (
                <TouchableOpacity
                  key={shift.label}
                  style={styles.shiftTypeButton}
                  onPress={() => handleSelectShift(shift.type, shift.defaultStart, shift.defaultEnd)}
                >
                  <Text style={styles.shiftTypeEmoji}>{shift.emoji}</Text>
                  <Text style={styles.shiftTypeLabel}>{shift.label}</Text>
                  <Text style={styles.shiftTypeTime}>
                    {shift.type ? `${shift.defaultStart} - ${shift.defaultEnd}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {selectedDay && cells[selectedDay - 1].shiftType && (
              <View style={styles.timeInputSection}>
                <Text style={styles.timeLabel}>Customize Times</Text>
                <View style={styles.timeInputRow}>
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.timeInputLabel}>Start Time</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={tempStartTime}
                      onChangeText={setTempStartTime}
                      placeholder="HH:mm"
                      maxLength={5}
                    />
                  </View>
                  <Text style={styles.timeSeparator}>—</Text>
                  <View style={styles.timeInputGroup}>
                    <Text style={styles.timeInputLabel}>End Time</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={tempEndTime}
                      onChangeText={setTempEndTime}
                      placeholder="HH:mm"
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.clearButton]}
                onPress={handleClearCell}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => {
                  setShowShiftPicker(false);
                  setSelectedDay(null);
                }}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveModalButton]}
                onPress={handleSaveCell}
              >
                <Text style={styles.saveModalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23', // Match app dark theme
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: Platform.OS === 'android' ? 120 : 80, // Extra padding for Android navigation
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF', // White text
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF', // Gray text
  },
  modeSection: {
    marginBottom: spacing.lg,
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: spacing.xs,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  modeButtonSubtext: {
    fontSize: 12,
    color: '#6B7280',
  },
  modeButtonSubtextActive: {
    color: '#E0E7FF',
  },
  modeHelpText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  nameSection: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // White labels
    marginBottom: spacing.sm,
  },
  nameInput: {
    backgroundColor: '#1A1A2E', // Dark input background
    borderWidth: 1,
    borderColor: '#2A2A3E', // Dark border
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: '#FFFFFF', // White text
  },
  weekSection: {
    marginBottom: spacing.lg,
  },
  weekTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF', // White title
    marginBottom: spacing.sm,
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    width: '13%',
    aspectRatio: 1,
    backgroundColor: '#1A1A2E', // Dark cell background
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#2A2A3E', // Dark border
    padding: spacing.xs,
    marginBottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF', // White day number
  },
  dayName: {
    fontSize: 8,
    color: '#9CA3AF', // Gray day name
    marginTop: 2,
  },
  shiftEmoji: {
    fontSize: 16,
    marginTop: 2,
  },
  shiftTime: {
    fontSize: 7,
    color: '#9CA3AF', // Gray time text
  },
  offLabel: {
    fontSize: 10,
    color: '#6B7280', // Gray off label
    marginTop: 4,
  },
  summarySection: {
    backgroundColor: '#1A1A2E', // Dark summary background
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: '#2A2A3E', // Dark border
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF', // White title
    marginBottom: spacing.sm,
  },
  summaryText: {
    fontSize: 16,
    color: '#9CA3AF', // Gray text
    marginBottom: spacing.xs,
  },
  helpText: {
    fontSize: 14,
    color: '#6B7280', // Gray help text
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF', // Gray cancel text
  },
  saveButton: {
    backgroundColor: '#6366F1', // Purple save button to match app
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // Darker overlay
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A2E', // Dark modal background
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF', // White modal title
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  shiftTypeList: {
    maxHeight: 300,
    marginBottom: spacing.md,
  },
  shiftTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#0F0F23', // Dark shift type button
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#2A2A3E', // Dark border
  },
  shiftTypeEmoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  shiftTypeLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF', // White label
  },
  shiftTypeTime: {
    fontSize: 14,
    color: '#9CA3AF', // Gray time
  },
  timeInputSection: {
    backgroundColor: '#0F0F23', // Dark time input section
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#2A2A3E', // Dark border
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF', // White label
    marginBottom: spacing.sm,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInputGroup: {
    flex: 1,
  },
  timeInputLabel: {
    fontSize: 14,
    color: '#9CA3AF', // Gray label
    marginBottom: spacing.xs,
  },
  timeInput: {
    backgroundColor: '#1A1A2E', // Dark input
    borderWidth: 1,
    borderColor: '#2A2A3E', // Dark border
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    textAlign: 'center',
    color: '#FFFFFF', // White text
  },
  timeSeparator: {
    fontSize: 20,
    color: '#9CA3AF', // Gray separator
    marginHorizontal: spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#1A1A2E', // Dark clear button
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  cancelModalButton: {
    backgroundColor: '#1A1A2E', // Dark cancel button
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  cancelModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF', // Gray text
  },
  saveModalButton: {
    backgroundColor: '#10B981',
  },
  saveModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
