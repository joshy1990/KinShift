/**
 * Edit Shift Screen
 * Loads an existing shift by ID and lets the user update title, type, times, and notes.
 * Re-uses the same visual language as AddShiftScreen.
 */

import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, Shift, ShiftType} from '@/types';
import {format} from 'date-fns';
import {shiftService} from '@/services/shift.service';
import {useAuth} from '@/contexts/AuthContext';
import {showSuccess, showError} from '@/utils/alert';
import {ShiftTypePicker} from '@/components/ShiftTypePicker';
import {TimePickerModal} from '@/components/TimePickerModal';
import {requiresStartEndTime} from '@/utils/shiftTypeHelpers';

type Props = NativeStackScreenProps<CalendarStackParamList, 'EditShift'>;

/** Safely convert a Firestore Timestamp or Date-like value to a real Date */
function toDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === 'string') return new Date(value);
  return new Date();
}

export const EditShiftScreen: React.FC<Props> = ({navigation, route}) => {
  const {shiftId} = route.params;
  const {user} = useAuth();

  // ── Loading / error state ──
  const [loadingShift, setLoadingShift] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shift, setShift] = useState<Shift | null>(null);

  // ── Form state ──
  const [title, setTitle] = useState('');
  const [shiftType, setShiftType] = useState<ShiftType>('day');
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Split shift state
  const [split1StartTime, setSplit1StartTime] = useState(new Date());
  const [split1EndTime, setSplit1EndTime] = useState(new Date());
  const [split2StartTime, setSplit2StartTime] = useState(new Date());
  const [split2EndTime, setSplit2EndTime] = useState(new Date());

  // Time picker modal
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [activeSplitPicker, setActiveSplitPicker] = useState<
    'split1Start' | 'split1End' | 'split2Start' | 'split2End' | null
  >(null);

  // ── Load existing shift ──
  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await shiftService.getShiftById(shiftId);
        if (!fetched) {
          showError('Shift not found');
          navigation.goBack();
          return;
        }
        setShift(fetched);

        // Hydrate form
        setTitle(fetched.title || '');
        setShiftType(fetched.shiftType || 'day');
        setStartTime(toDate(fetched.startTime));
        setEndTime(toDate(fetched.endTime));
        setNotes(fetched.notes || '');

        // Split times
        if (fetched.splitTimes && fetched.splitTimes.length >= 2) {
          setSplit1StartTime(toDate(fetched.splitTimes[0].startTime));
          setSplit1EndTime(toDate(fetched.splitTimes[0].endTime));
          setSplit2StartTime(toDate(fetched.splitTimes[1].startTime));
          setSplit2EndTime(toDate(fetched.splitTimes[1].endTime));
        }
      } catch (error) {
        console.error('[EditShift] Failed to load shift:', error);
        showError('Failed to load shift');
        navigation.goBack();
      } finally {
        setLoadingShift(false);
      }
    };
    load();
  }, [shiftId, navigation]);

  // ── Handlers ──

  const handleShiftTypeChange = (newType: ShiftType) => {
    if (newType === 'custom') return; // custom navigates to PatternBuilder in Add, not relevant here
    setShiftType(newType);
  };

  const openTimePicker_ = (type: 'start' | 'end') => {
    const time = type === 'start' ? startTime : endTime;
    setPickerHour(time.getHours());
    setPickerMinute(time.getMinutes());
    setTimePickerType(type);
    setActiveSplitPicker(null);
    setShowTimePicker(true);
  };

  const openSplitPicker = (which: 'split1Start' | 'split1End' | 'split2Start' | 'split2End') => {
    const timeMap = {
      split1Start: split1StartTime,
      split1End: split1EndTime,
      split2Start: split2StartTime,
      split2End: split2EndTime,
    };
    const t = timeMap[which];
    setPickerHour(t.getHours());
    setPickerMinute(t.getMinutes());
    setActiveSplitPicker(which);
    setShowTimePicker(true);
  };

  const applyPickerTime = () => {
    if (activeSplitPicker) {
      const base = startTime;
      const newTime = new Date(base);
      newTime.setHours(pickerHour, pickerMinute, 0, 0);
      switch (activeSplitPicker) {
        case 'split1Start': setSplit1StartTime(newTime); break;
        case 'split1End': setSplit1EndTime(newTime); break;
        case 'split2Start': setSplit2StartTime(newTime); break;
        case 'split2End': setSplit2EndTime(newTime); break;
      }
    } else {
      const base = timePickerType === 'start' ? startTime : endTime;
      const newTime = new Date(base);
      newTime.setHours(pickerHour, pickerMinute, 0, 0);
      if (timePickerType === 'start') {
        setStartTime(newTime);
      } else {
        setEndTime(newTime);
      }
    }
    setActiveSplitPicker(null);
    setShowTimePicker(false);
  };

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      showError('Please fix the errors before saving');
      return;
    }
    if (!user) {
      showError('You must be logged in');
      return;
    }

    setSaving(true);

    try {
      const updates: any = {
        title: title.trim(),
        shiftType,
        notes: notes.trim(),
      };

      // Only include times for types that use them
      if (requiresStartEndTime(shiftType)) {
        if (shiftType === 'split') {
          updates.startTime = split1StartTime;
          updates.endTime = split2EndTime;
          updates.splitTimes = [
            {startTime: split1StartTime, endTime: split1EndTime},
            {startTime: split2StartTime, endTime: split2EndTime},
          ];
        } else {
          updates.startTime = startTime;
          updates.endTime = endTime;
        }
      }

      await shiftService.updateShift(shiftId, updates, user.id);
      showSuccess('Shift updated successfully!');
      setSaving(false);
      setSaved(true);
      setTimeout(() => navigation.goBack(), 900);
    } catch (error: any) {
      console.error('[EditShift] Save failed:', error);
      showError(error?.message || 'Failed to update shift');
      setSaving(false);
    }
  }, [validateForm, title, shiftType, notes, startTime, endTime, split1StartTime, split1EndTime, split2StartTime, split2EndTime, shiftId, user, navigation]);

  // ── Loading state ──
  if (loadingShift) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading shift…</Text>
      </SafeAreaView>
    );
  }

  if (!shift) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <Text style={styles.loadingText}>Shift not found</Text>
      </SafeAreaView>
    );
  }

  // ── Render ──
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#0F0F23'}} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Title */}
            <View style={styles.section}>
              <Text style={styles.label}>Shift Title *</Text>
              <TextInput
                style={[styles.input, errors.title ? styles.inputError : null]}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Day Shift, Night Shift"
                placeholderTextColor="#6B7280"
              />
              {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
            </View>

            {/* Date (read-only) */}
            <View style={styles.section}>
              <Text style={styles.label}>Date</Text>
              <View style={styles.dateBox}>
                <Text style={styles.dateText}>
                  📅 {format(startTime, 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
            </View>

            {/* Shift Type */}
            <View style={styles.section}>
              <ShiftTypePicker
                selectedType={shiftType}
                onSelectType={handleShiftTypeChange}
                quickAccessOnly={true}
              />
            </View>

            {/* Times — standard (not split) */}
            {requiresStartEndTime(shiftType) && shiftType !== 'split' && (
              <>
                <View style={styles.section}>
                  <Text style={styles.label}>Start Time *</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openTimePicker_('start')}>
                    <Text style={styles.timePickerText}>
                      🕐 {format(startTime, 'HH:mm')}
                    </Text>
                    <Text style={styles.timePickerHint}>Tap to change</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.section}>
                  <Text style={styles.label}>End Time *</Text>
                  <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => openTimePicker_('end')}>
                    <Text style={styles.timePickerText}>
                      🕐 {format(endTime, 'HH:mm')}
                    </Text>
                    <Text style={styles.timePickerHint}>Tap to change</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Split Shift Times */}
            {shiftType === 'split' && (
              <View style={styles.section}>
                <Text style={styles.label}>Split Shift Times *</Text>
                <Text style={styles.helperText}>
                  Two separate time ranges for your split shift
                </Text>

                {/* Shift 1 */}
                <View style={styles.splitShiftContainer}>
                  <Text style={styles.splitShiftLabel}>Shift 1</Text>
                  <View style={styles.splitTimeRow}>
                    <View style={styles.splitTimeItem}>
                      <Text style={styles.splitTimeItemLabel}>Start</Text>
                      <TouchableOpacity
                        style={styles.splitTimeButton}
                        onPress={() => openSplitPicker('split1Start')}>
                        <Text style={styles.splitTimeText}>
                          {format(split1StartTime, 'HH:mm')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.splitTimeSeparator}>→</Text>
                    <View style={styles.splitTimeItem}>
                      <Text style={styles.splitTimeItemLabel}>End</Text>
                      <TouchableOpacity
                        style={styles.splitTimeButton}
                        onPress={() => openSplitPicker('split1End')}>
                        <Text style={styles.splitTimeText}>
                          {format(split1EndTime, 'HH:mm')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Shift 2 */}
                <View style={styles.splitShiftContainer}>
                  <Text style={styles.splitShiftLabel}>Shift 2</Text>
                  <View style={styles.splitTimeRow}>
                    <View style={styles.splitTimeItem}>
                      <Text style={styles.splitTimeItemLabel}>Start</Text>
                      <TouchableOpacity
                        style={styles.splitTimeButton}
                        onPress={() => openSplitPicker('split2Start')}>
                        <Text style={styles.splitTimeText}>
                          {format(split2StartTime, 'HH:mm')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.splitTimeSeparator}>→</Text>
                    <View style={styles.splitTimeItem}>
                      <Text style={styles.splitTimeItemLabel}>End</Text>
                      <TouchableOpacity
                        style={styles.splitTimeButton}
                        onPress={() => openSplitPicker('split2End')}>
                        <Text style={styles.splitTimeText}>
                          {format(split2EndTime, 'HH:mm')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Text style={styles.splitTotalHours}>
                  Total:{' '}
                  {(
                    (split1EndTime.getTime() - split1StartTime.getTime() +
                      split2EndTime.getTime() - split2StartTime.getTime()) /
                    (1000 * 60 * 60)
                  ).toFixed(1)}{' '}
                  hours
                </Text>
              </View>
            )}

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any additional details..."
                placeholderTextColor="#6B7280"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
                disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled, saved && styles.saveButtonSaved]}
                onPress={handleSave}
                disabled={saving || saved}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{saved ? 'Saved ✓' : 'Save Changes'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Time Picker Modal */}
        <TimePickerModal
          visible={showTimePicker}
          title={`Select ${activeSplitPicker
            ? activeSplitPicker.replace('split', 'Shift ').replace('Start', ' Start').replace('End', ' End')
            : timePickerType === 'start' ? 'Start' : 'End'} Time`}
          hour={pickerHour}
          minute={pickerMinute}
          onHourChange={setPickerHour}
          onMinuteChange={setPickerMinute}
          onApply={applyPickerTime}
          onCancel={() => setShowTimePicker(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Styles ──
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
  },
  dateBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  dateText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  timePickerButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timePickerText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timePickerHint: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  splitShiftContainer: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  splitShiftLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A1A1AA',
    marginBottom: 8,
  },
  splitTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  splitTimeItem: {
    flex: 1,
    alignItems: 'center',
  },
  splitTimeItemLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  splitTimeButton: {
    backgroundColor: '#0F0F23',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  splitTimeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  splitTimeSeparator: {
    fontSize: 18,
    color: '#6366F1',
    marginHorizontal: 8,
  },
  splitTotalHours: {
    fontSize: 14,
    color: '#A1A1AA',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 32,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonSaved: {
    backgroundColor: '#10B981',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
