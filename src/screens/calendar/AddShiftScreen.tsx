import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, ShiftType} from '@/types';
import {format} from 'date-fns';
import {shiftService} from '@/services/shift.service';
import {notificationService} from '@/services/notification.service';
import {useAuth} from '@/contexts/AuthContext';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';
import {showAlert, showSuccess, showError} from '@/utils/alert';
import {
  detectShiftType,
  getShiftTypeDisplayName,
  getShiftTypeIcon,
  SHIFT_TYPE_COLORS,
} from '@/utils/shiftColors';

type Props = NativeStackScreenProps<CalendarStackParamList, 'AddShift'>;

// Simple pattern presets
const SIMPLE_PATTERNS = {
  '4on4off': { name: '4 On, 4 Off', workDays: 4, restDays: 4 },
  '2on3off': { name: '2 On, 3 Off', workDays: 2, restDays: 3 },
  '5on2off': { name: '5 On, 2 Off (Mon-Fri)', workDays: 5, restDays: 2 },
  '2d2n': { name: '2 Days, 2 Nights, Off', desc: '2 day shifts, then 2 night shifts, then days off' },
};

export const AddShiftScreen: React.FC<Props> = ({navigation, route}) => {
  const {user} = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [is24HourFormat, setIs24HourFormat] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerType, setTimePickerType] = useState<'start' | 'end'>('start');
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);
  
  const initialStartTime = route.params?.date || new Date();
  initialStartTime.setHours(9, 0, 0, 0); // 9 AM default
  const initialEndTime = new Date(initialStartTime);
  initialEndTime.setHours(17, 0, 0, 0); // 5 PM default
  
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [startTimeText, setStartTimeText] = useState(
    is24HourFormat ? format(initialStartTime, 'HH:mm') : format(initialStartTime, 'h:mm a')
  );
  const [endTimeText, setEndTimeText] = useState(
    is24HourFormat ? format(initialEndTime, 'HH:mm') : format(initialEndTime, 'h:mm a')
  );
  const [startAMPM, setStartAMPM] = useState<'AM' | 'PM'>(initialStartTime.getHours() >= 12 ? 'PM' : 'AM');
  const [endAMPM, setEndAMPM] = useState<'AM' | 'PM'>(initialEndTime.getHours() >= 12 ? 'PM' : 'AM');
  const [shiftType, setShiftType] = useState<ShiftType>(detectShiftType(initialStartTime, initialEndTime));
  const [notes, setNotes] = useState('');
  const [usePattern, setUsePattern] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<keyof typeof SIMPLE_PATTERNS>('4on4off');
  const [patternMonths, setPatternMonths] = useState(6);

  // Smart time input formatting - handles "0455" → "04:55", "455" → "04:55", "4:55" → "04:55"
  const formatTimeInput = (input: string): string => {
    // Remove all non-digits
    const digitsOnly = input.replace(/\D/g, '');
    
    if (digitsOnly.length === 0) return '';
    if (digitsOnly.length <= 2) {
      // Just hours: "4" or "04"
      return digitsOnly;
    }
    if (digitsOnly.length === 3) {
      // "455" → "04:55"
      return `${digitsOnly[0].padStart(2, '0')}:${digitsOnly.substring(1)}`;
    }
    if (digitsOnly.length >= 4) {
      // "0455" → "04:55"
      const hours = digitsOnly.substring(0, 2);
      const minutes = digitsOnly.substring(2, 4);
      return `${hours}:${minutes}`;
    }
    return input;
  };

  // Parse custom time input with smart formatting
  const parseTimeInput = (input: string, type: 'start' | 'end') => {
    // Format as user types
    const formatted = formatTimeInput(input);
    
    // Update the text field immediately
    if (type === 'start') {
      setStartTimeText(formatted);
    } else {
      setEndTimeText(formatted);
    }
    
    // Parse the formatted time
    const timeParts = formatted.match(/(\d{1,2}):?(\d{0,2})/);
    if (!timeParts) return;
    
    let hours = parseInt(timeParts[1]);
    let minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;
    
    // Handle 12hr format with AM/PM
    if (!is24HourFormat) {
      const ampm = type === 'start' ? startAMPM : endAMPM;
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    }
    
    // Validate
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return;
    
    // Create new time
    const baseTime = type === 'start' ? startTime : endTime;
    const newTime = new Date(baseTime);
    newTime.setHours(hours, minutes, 0, 0);
    
    if (type === 'start') {
      setStartTime(newTime);
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndTime(newTime);
      setShiftType(detectShiftType(startTime, newTime));
    }
  };

  // Toggle AM/PM for 12hr format
  const toggleAMPM = (type: 'start' | 'end', value: 'AM' | 'PM') => {
    if (type === 'start') {
      setStartAMPM(value);
      const newTime = new Date(startTime);
      let hours = newTime.getHours();
      if (value === 'PM' && hours < 12) {
        hours += 12;
      } else if (value === 'AM' && hours >= 12) {
        hours -= 12;
      }
      newTime.setHours(hours);
      setStartTime(newTime);
      setStartTimeText(format(newTime, 'h:mm'));
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndAMPM(value);
      const newTime = new Date(endTime);
      let hours = newTime.getHours();
      if (value === 'PM' && hours < 12) {
        hours += 12;
      } else if (value === 'AM' && hours >= 12) {
        hours -= 12;
      }
      newTime.setHours(hours);
      setEndTime(newTime);
      setEndTimeText(format(newTime, 'h:mm'));
      setShiftType(detectShiftType(startTime, newTime));
    }
  };

  // Toggle 12hr/24hr format
  const toggle24HourFormat = () => {
    const new24Hr = !is24HourFormat;
    setIs24HourFormat(new24Hr);
    
    // Reformat time displays
    if (new24Hr) {
      setStartTimeText(format(startTime, 'HH:mm'));
      setEndTimeText(format(endTime, 'HH:mm'));
    } else {
      setStartTimeText(format(startTime, 'h:mm'));
      setEndTimeText(format(endTime, 'h:mm'));
      setStartAMPM(startTime.getHours() >= 12 ? 'PM' : 'AM');
      setEndAMPM(endTime.getHours() >= 12 ? 'PM' : 'AM');
    }
  };

  // Simple time adjustment
  const adjustTime = (type: 'start' | 'end', hours: number) => {
    const current = type === 'start' ? startTime : endTime;
    const newTime = new Date(current);
    newTime.setHours(hours, 0, 0, 0);
    
    if (type === 'start') {
      setStartTime(newTime);
      setStartTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm'));
      setStartAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      // Auto-detect shift type
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndTime(newTime);
      setEndTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm'));
      setEndAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      setShiftType(detectShiftType(startTime, newTime));
    }
  };

  // Open time picker modal
  const openTimePicker = (type: 'start' | 'end') => {
    const time = type === 'start' ? startTime : endTime;
    setPickerHour(time.getHours());
    setPickerMinute(time.getMinutes());
    setTimePickerType(type);
    setShowTimePicker(true);
  };

  // Apply selected time from picker
  const applyPickerTime = () => {
    const newTime = new Date(timePickerType === 'start' ? startTime : endTime);
    newTime.setHours(pickerHour, pickerMinute, 0, 0);
    
    if (timePickerType === 'start') {
      setStartTime(newTime);
      setStartTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm a'));
      setStartAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      setShiftType(detectShiftType(newTime, endTime));
    } else {
      setEndTime(newTime);
      setEndTimeText(is24HourFormat ? format(newTime, 'HH:mm') : format(newTime, 'h:mm a'));
      setEndAMPM(newTime.getHours() >= 12 ? 'PM' : 'AM');
      setShiftType(detectShiftType(startTime, newTime));
    }
    setShowTimePicker(false);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    // Allow overnight shifts - don't validate end time must be after start time
    // Example: Night shift 10pm to 6am is valid even though 22:00 > 06:00
    // The shift can span midnight

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      showError('Please fix the errors before saving');
      return;
    }
    if (!user) {
      showError('You must be logged in to create shifts');
      return;
    }

    setLoading(true);
    try {
      if (usePattern) {
        // Create pattern of shifts
        const pattern = SIMPLE_PATTERNS[selectedPattern];
        const shiftsToCreate: any[] = [];
        const endDate = new Date(startTime);
        endDate.setMonth(endDate.getMonth() + patternMonths);
        
        let currentDate = new Date(startTime);
        
        if ('workDays' in pattern) {
          // Simple work/rest pattern (e.g., 4 on 4 off)
          let isWorkPeriod = true;
          
          while (currentDate <= endDate) {
            const daysInPeriod = isWorkPeriod ? pattern.workDays : pattern.restDays;
            
            if (isWorkPeriod) {
              // Create shifts for work days
              for (let i = 0; i < daysInPeriod && currentDate <= endDate; i++) {
                const shiftStart = new Date(currentDate);
                shiftStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
                
                const shiftEnd = new Date(currentDate);
                shiftEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
                
                // Handle overnight shifts
                if (shiftEnd <= shiftStart) {
                  shiftEnd.setDate(shiftEnd.getDate() + 1);
                }
                
                shiftsToCreate.push({
                  title: title.trim(),
                  householdId: currentHouseholdId || undefined,
                  ownerId: user.id,
                  startTime: shiftStart,
                  endTime: shiftEnd,
                  shiftType,
                  notes: notes.trim(),
                });
                
                currentDate.setDate(currentDate.getDate() + 1);
              }
            } else {
              // Skip rest days
              currentDate.setDate(currentDate.getDate() + daysInPeriod);
            }
            
            isWorkPeriod = !isWorkPeriod;
          }
        }
        
        // Create all shifts in batch (MUCH FASTER!)
        console.log(`Creating ${shiftsToCreate.length} shifts using batch write...`);
        const startBatch = Date.now();
        await shiftService.createBulkShifts(shiftsToCreate);
        const batchTime = Date.now() - startBatch;
        console.log(`✅ Batch creation completed in ${batchTime}ms (${(batchTime / shiftsToCreate.length).toFixed(1)}ms per shift)`);
        
        // Send ONE notification for all pattern shifts created
        if (currentHouseholdId) {
          try {
            await notificationService.notifyMultipleShiftsCreated(
              currentHouseholdId,
              user.name || user.email.split('@')[0],
              shiftsToCreate.length,
              user.id // Exclude creator
            );
          } catch (notifyError) {
            console.error('Failed to send pattern shift notification:', notifyError);
            // Don't fail the shift creation if notification fails
          }
        }
        
        showSuccess(`Created ${shiftsToCreate.length} shifts successfully!`);
      } else {
        // Create single shift
        const newShift = await shiftService.createShift({
          title: title.trim(),
          householdId: currentHouseholdId || undefined,
          ownerId: user.id,
          startTime,
          endTime,
          shiftType,
          notes: notes.trim(),
        });

        // Send notification for single shift creation (only in household mode)
        if (currentHouseholdId && newShift.id) {
          try {
            await notificationService.notifyShiftCreated(
              currentHouseholdId,
              newShift.id,
              title,
              user.name || user.email.split('@')[0],
              user.id // Exclude creator from notification
            );
          } catch (notifyError) {
            console.error('Failed to send shift creation notification:', notifyError);
            // Don't fail the shift creation if notification fails
          }
        }

        showSuccess('Shift created successfully!');
      }
      
      navigation.goBack();
    } catch (error) {
      console.error('Failed to create shift:', error);
      showError('Failed to create shift. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
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

        {/* Date Display */}
        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity 
            style={styles.dateBox}
            onPress={() => {
              // Could add DatePicker here for native platforms
              showAlert('Date Selection', 'Tap on a date in the calendar to create a shift for that day, or manually adjust the date below.');
            }}>
            <Text style={styles.dateText}>
              📅 {format(startTime, 'EEEE, MMMM d, yyyy')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>Shifts are created for the selected calendar date</Text>
        </View>

        {/* Quick Shift Presets */}
        <View style={styles.section}>
          <Text style={styles.label}>Quick Shift Templates</Text>
          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                setTitle('Day Shift');
                adjustTime('start', 9);  // 9 AM
                adjustTime('end', 17);   // 5 PM
                setShiftType('days');
              }}>
              <Text style={styles.presetIcon}>☀️</Text>
              <Text style={styles.presetLabel}>Day</Text>
              <Text style={styles.presetTime}>9AM-5PM</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                setTitle('Afternoon Shift');
                adjustTime('start', 14); // 2 PM
                adjustTime('end', 22);   // 10 PM
                setShiftType('afternoons');
              }}>
              <Text style={styles.presetIcon}>🌤️</Text>
              <Text style={styles.presetLabel}>Afternoon</Text>
              <Text style={styles.presetTime}>2PM-10PM</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => {
                setTitle('Night Shift');
                adjustTime('start', 22); // 10 PM
                adjustTime('end', 6);    // 6 AM (next day)
                setShiftType('nights');
              }}>
              <Text style={styles.presetIcon}>🌙</Text>
              <Text style={styles.presetLabel}>Night</Text>
              <Text style={styles.presetTime}>10PM-6AM</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Tap a template to quickly fill in common shift times</Text>
        </View>

        {/* Time Format Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <Text style={styles.label}>Time Format</Text>
            <TouchableOpacity 
              style={[styles.formatToggle, is24HourFormat && styles.formatToggleActive]}
              onPress={toggle24HourFormat}>
              <Text style={[styles.formatToggleText, is24HourFormat && styles.formatToggleTextActive]}>
                {is24HourFormat ? '24 Hour' : '12 Hour'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Times */}
        <View style={styles.section}>
          <Text style={styles.label}>Start Time *</Text>
          <TouchableOpacity 
            style={styles.timePickerButton}
            onPress={() => openTimePicker('start')}>
            <Text style={styles.timePickerText}>
              🕐 {startTimeText} {!is24HourFormat && startAMPM}
            </Text>
            <Text style={styles.timePickerHint}>Tap to change</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>End Time *</Text>
          <TouchableOpacity 
            style={styles.timePickerButton}
            onPress={() => openTimePicker('end')}>
            <Text style={styles.timePickerText}>
              🕐 {endTimeText} {!is24HourFormat && endAMPM}
            </Text>
            <Text style={styles.timePickerHint}>Tap to change</Text>
          </TouchableOpacity>
          {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}
        </View>

        {/* Shift Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Shift Type</Text>
          <Text style={styles.helperText}>Auto-detected based on your shift times</Text>
          <View style={styles.shiftTypeRow}>
            {(['days', 'afternoons', 'nights'] as ShiftType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.shiftTypeButton,
                  {backgroundColor: SHIFT_TYPE_COLORS[type]},
                  shiftType === type && styles.shiftTypeButtonActive,
                ]}
                onPress={() => setShiftType(type)}>
                <Text style={styles.shiftTypeIcon}>{getShiftTypeIcon(type)}</Text>
                <Text style={styles.shiftTypeLabel}>{getShiftTypeDisplayName(type)}</Text>
                {shiftType === type && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

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

        {/* Pattern Toggle */}
        <View style={styles.section}>
          <View style={styles.patternHeader}>
            <View>
              <Text style={styles.label}>Repeat Pattern</Text>
              <Text style={styles.helperText}>Create recurring shifts automatically</Text>
            </View>
            <Switch
              value={usePattern}
              onValueChange={setUsePattern}
              trackColor={{false: '#374151', true: '#6366F1'}}
              thumbColor={'#FFFFFF'}
            />
          </View>

          {usePattern && (
            <View style={styles.patternContent}>
              <Text style={styles.patternSubtitle}>Select Pattern:</Text>
              <View style={styles.patternGrid}>
                {(Object.entries(SIMPLE_PATTERNS) as [keyof typeof SIMPLE_PATTERNS, typeof SIMPLE_PATTERNS[keyof typeof SIMPLE_PATTERNS]][]).map(([key, pattern]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.patternCard,
                      selectedPattern === key && styles.patternCardActive,
                    ]}
                    onPress={() => setSelectedPattern(key)}>
                    <Text style={[
                      styles.patternName,
                      selectedPattern === key && styles.patternNameActive,
                    ]}>
                      {pattern.name}
                    </Text>
                    {'desc' in pattern && (
                      <Text style={[
                        styles.patternDesc,
                        selectedPattern === key && styles.patternDescActive,
                      ]}>
                        {pattern.desc}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.patternSubtitle}>Duration:</Text>
              <View style={styles.durationRow}>
                {[3, 6, 9, 12].map((months) => (
                  <TouchableOpacity
                    key={months}
                    style={[
                      styles.durationButton,
                      patternMonths === months && styles.durationButtonActive,
                    ]}
                    onPress={() => setPatternMonths(months)}>
                    <Text style={[
                      styles.durationText,
                      patternMonths === months && styles.durationTextActive,
                    ]}>
                      {months}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  ℹ️ Pattern will create shifts for {patternMonths} months starting from {format(startTime, 'MMM d')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {usePattern ? 'Create Pattern' : 'Create Shift'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select {timePickerType === 'start' ? 'Start' : 'End'} Time
            </Text>
            
            <View style={styles.pickerContainer}>
              {/* Hour Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Hour</Text>
                <ScrollView 
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}>
                  {Array.from({length: 24}, (_, i) => i).map((hour) => (
                    <TouchableOpacity
                      key={hour}
                      style={[
                        styles.pickerItem,
                        pickerHour === hour && styles.pickerItemActive
                      ]}
                      onPress={() => setPickerHour(hour)}>
                      <Text style={[
                        styles.pickerItemText,
                        pickerHour === hour && styles.pickerItemTextActive
                      ]}>
                        {String(hour).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Minute Picker */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>Minute</Text>
                <ScrollView 
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={false}>
                  {Array.from({length: 12}, (_, i) => i * 5).map((minute) => (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.pickerItem,
                        pickerMinute === minute && styles.pickerItemActive
                      ]}
                      onPress={() => setPickerMinute(minute)}>
                      <Text style={[
                        styles.pickerItemText,
                        pickerMinute === minute && styles.pickerItemTextActive
                      ]}>
                        {String(minute).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={applyPickerTime}>
                <Text style={styles.modalSaveButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
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
  timeInputRow: {
    marginBottom: 12,
  },
  timeTextInput: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  timeHelperText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  quickSelectLabel: {
    fontSize: 13,
    color: '#A1A1AA',
    marginBottom: 8,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 70,
    alignItems: 'center',
  },
  timeButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  timeButtonText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  timeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  shiftTypeRow: {
    flexDirection: 'column',
    gap: 12,
  },
  shiftTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shiftTypeButtonActive: {
    borderColor: '#FFFFFF',
  },
  shiftTypeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  shiftTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  patternContent: {
    marginTop: 16,
  },
  patternSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A1A1AA',
    marginBottom: 12,
  },
  patternGrid: {
    gap: 12,
    marginBottom: 20,
  },
  patternCard: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    padding: 16,
  },
  patternCardActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  patternName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  patternNameActive: {
    color: '#6366F1',
  },
  patternDesc: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  patternDescActive: {
    color: '#A1A1AA',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  durationButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  durationText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  durationTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6366F1',
  },
  infoText: {
    fontSize: 13,
    color: '#A1A1AA',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formatToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  formatToggleActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  formatToggleText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  formatToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ampmButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  ampmButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4B5563',
    minWidth: 50,
    alignItems: 'center',
  },
  ampmButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  ampmText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  ampmTextActive: {
    color: '#FFFFFF',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  presetTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  timePickerButton: {
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 8,
  },
  timePickerText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  timePickerHint: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2A2A3E',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 12,
    textAlign: 'center',
  },
  pickerScroll: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    backgroundColor: '#0F0F23',
  },
  pickerItem: {
    padding: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  pickerItemActive: {
    backgroundColor: '#6366F1',
  },
  pickerItemText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  pickerItemTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalSaveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
