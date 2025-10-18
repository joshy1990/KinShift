import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, ShiftType, PatternRule} from '@/types';
import {format, addDays} from 'date-fns';
import {shiftService} from '@/services/shift.service';
import {useAuth} from '@/contexts/AuthContext';
import {
  detectShiftType,
  getShiftTypeDisplayName,
  getShiftTypeIcon,
  SHIFT_TYPE_COLORS,
} from '@/utils/shiftColors';

type Props = NativeStackScreenProps<CalendarStackParamList, 'AddShift'>;

interface FormData {
  title: string;
  startTime: Date;
  endTime: Date;
  shiftType: ShiftType;
  notes: string;
  usePattern: boolean;
  patternType?: '4on4off' | '2on3off' | '5on2off' | '2days2nights' | 'custom';
  patternDurationMonths?: number;
}

// Simple pattern presets
const SIMPLE_PATTERNS = {
  '4on4off': { name: '4 Days On, 4 Off', workDays: 4, restDays: 4 },
  '2on3off': { name: '2 Days On, 3 Off', workDays: 2, restDays: 3 },
  '5on2off': { name: '5 Days On, 2 Off', workDays: 5, restDays: 2 },
  '2days2nights': { name: '2 Days, 2 Nights, Off', workDays: 2, nightsAfter: 2, restDays: 4 },
};

export const AddShiftScreen: React.FC<Props> = ({navigation, route}) => {
  const [loading, setLoading] = useState(false);
  const [creatingPattern, setCreatingPattern] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [patternPreviewDates, setPatternPreviewDates] = useState<Date[]>([]);
  const [estimatedShiftCount, setEstimatedShiftCount] = useState<number>(0);
  const [formData, setFormData] = useState<FormData>(() => {
    const startTime = route.params?.date || new Date();
    const endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000); // 8 hour shift default
    const detectedType = detectShiftType(startTime, endTime);
    
    return {
      title: '',
      startTime,
      endTime,
      shiftType: detectedType,
      notes: '',
      usePattern: false,
      selectedPattern: '4on4off',
      patternStartDate: startTime,
      patternDurationMonths: 6,
    };
  });

  // shiftService is imported as a singleton instance

  // Update pattern preview when pattern settings change
  useEffect(() => {
    if (formData.usePattern && formData.selectedPattern) {
      // Get preview dates (30 days)
      const preview = shiftPatternService.previewPattern(
        formData.selectedPattern,
        formData.patternStartDate || formData.startTime,
        30
      );
      setPatternPreviewDates(preview);

      // Calculate total shifts
      const count = shiftPatternService.calculateShiftCount(
        formData.selectedPattern,
        formData.patternStartDate || formData.startTime,
        formData.patternDurationMonths || 6
      );
      setEstimatedShiftCount(count);
    } else {
      setPatternPreviewDates([]);
      setEstimatedShiftCount(0);
    }
  }, [
    formData.usePattern,
    formData.selectedPattern,
    formData.patternStartDate,
    formData.patternDurationMonths,
    formData.startTime,
  ]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (formData.startTime >= formData.endTime) {
      newErrors.time = 'End time must be after start time';
    }

    if (formData.startTime < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      newErrors.startTime = 'Start time cannot be in the past';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // TODO: Get current user and household from auth context
      const currentUserId = 'user1'; // This should come from AuthContext
      const currentHouseholdId = 'household1'; // This should come from user's household
      const currentUserName = 'Current User'; // Should come from AuthContext

      if (formData.usePattern && formData.selectedPattern) {
        // Creating pattern-based shifts
        setCreatingPattern(true);
        
        // Validate pattern first
        const validation = shiftPatternService.validatePattern(formData.selectedPattern);
        if (!validation.valid) {
          Alert.alert('Invalid Pattern', validation.error || 'Please check pattern settings');
          setCreatingPattern(false);
          setLoading(false);
          return;
        }

        // Show confirmation with estimated count
        const shiftCount = estimatedShiftCount;
        Alert.alert(
          'Create Shift Pattern',
          `This will create approximately ${shiftCount} shifts over ${formData.patternDurationMonths} months. Continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setCreatingPattern(false);
                setLoading(false);
              },
            },
            {
              text: 'Create',
              onPress: async () => {
                try {
                  const result = await shiftPatternService.generateShiftsFromPattern(
                    {
                      patternKey: formData.selectedPattern!,
                      startDate: formData.patternStartDate || formData.startTime,
                      shiftStartTime: format(formData.startTime, 'HH:mm'),
                      shiftEndTime: format(formData.endTime, 'HH:mm'),
                      title: formData.title.trim(),
                      householdId: currentHouseholdId,
                      ownerId: currentUserId,
                      shiftType: formData.shiftType,
                      notes: formData.notes.trim(),
                      durationMonths: formData.patternDurationMonths,
                    },
                    currentUserName
                  );

                  setCreatingPattern(false);
                  setLoading(false);

                  if (result.success) {
                    Alert.alert(
                      'Success!',
                      `Created ${result.shiftsCreated} shifts successfully!`,
                      [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                  } else {
                    Alert.alert(
                      'Partial Success',
                      `Created ${result.shiftsCreated} shifts, but encountered ${result.errors.length} errors.`,
                      [{ text: 'OK', onPress: () => navigation.goBack() }]
                    );
                  }
                } catch (error) {
                  setCreatingPattern(false);
                  setLoading(false);
                  Alert.alert('Error', 'Failed to create shift pattern. Please try again.');
                }
              },
            },
          ]
        );
        return;
      }

      // Single shift creation (original logic)
      await shiftService.createShift({
        title: formData.title.trim(),
        householdId: currentHouseholdId,
        ownerId: currentUserId,
        startTime: formData.startTime,
        endTime: formData.endTime,
        shiftType: formData.shiftType,
        notes: formData.notes.trim(),
      });

      Alert.alert(
        'Success',
        'Shift created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create shift. Please try again.');
    } finally {
      setLoading(false);
      setCreatingPattern(false);
    }
  };

  const updateDateTime = (field: 'startTime' | 'endTime', hours: number, minutes: number) => {
    const newDate = new Date(formData[field]);
    newDate.setHours(hours, minutes, 0, 0);
    
    const newFormData = {...formData, [field]: newDate};
    
    // Auto-adjust end time if start time is changed
    if (field === 'startTime' && newDate >= formData.endTime) {
      newFormData.endTime = new Date(newDate.getTime() + 60 * 60 * 1000);
    }
    
    setFormData(newFormData);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.form}>
        {/* Title Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={[styles.input, errors.title ? styles.inputError : null]}
            value={formData.title}
            onChangeText={(text) => {
              setFormData({...formData, title: text});
              if (errors.title) {
                setErrors({...errors, title: ''});
              }
            }}
            placeholder="Enter shift title"
            maxLength={50}
          />
          {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
        </View>

        {/* Date Display */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Date</Text>
          <View style={styles.dateDisplay}>
            <Text style={styles.dateText}>
              {format(formData.startTime, 'EEEE, MMMM d, yyyy')}
            </Text>
          </View>
        </View>

        {/* Time Fields */}
        <View style={styles.timeContainer}>
          <View style={styles.timeField}>
            <Text style={styles.label}>Start Time *</Text>
            <TouchableOpacity 
              style={[styles.timeInput, errors.startTime ? styles.inputError : null]}
              onPress={() => {
                // TODO: Open time picker modal
                Alert.alert('Time Picker', 'Time picker modal will be implemented');
              }}>
              <Text style={styles.timeText}>
                {format(formData.startTime, 'HH:mm')}
              </Text>
            </TouchableOpacity>
            {errors.startTime && <Text style={styles.errorText}>{errors.startTime}</Text>}
          </View>

          <View style={styles.timeField}>
            <Text style={styles.label}>End Time *</Text>
            <TouchableOpacity 
              style={[styles.timeInput, errors.time ? styles.inputError : null]}
              onPress={() => {
                // TODO: Open time picker modal
                Alert.alert('Time Picker', 'Time picker modal will be implemented');
              }}>
              <Text style={styles.timeText}>
                {format(formData.endTime, 'HH:mm')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {errors.time && <Text style={styles.errorText}>{errors.time}</Text>}

        {/* Shift Type Selection */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Shift Type</Text>
          <View style={styles.shiftTypeContainer}>
            {(['days', 'afternoons', 'nights', 'morning', 'evening'] as ShiftType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.shiftTypeOption,
                  {backgroundColor: SHIFT_TYPE_COLORS[type]},
                  formData.shiftType === type && styles.selectedShiftType,
                ]}
                onPress={() => setFormData({...formData, shiftType: type})}>
                <Text style={styles.shiftTypeIcon}>{getShiftTypeIcon(type)}</Text>
                <Text style={styles.shiftTypeLabel}>{getShiftTypeDisplayName(type)}</Text>
                {formData.shiftType === type && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pattern Selection */}
        <View style={styles.fieldContainer}>
          <View style={styles.patternHeader}>
            <Text style={styles.label}>Repeat Pattern</Text>
            <Switch
              value={formData.usePattern}
              onValueChange={(value) => setFormData({...formData, usePattern: value})}
              trackColor={{false: '#BDC3C7', true: '#6366F1'}}
              thumbColor={'#FFFFFF'}
            />
          </View>
          
          {formData.usePattern && (
            <>
              <Text style={styles.patternDescription}>
                Select a work pattern to automatically create recurring shifts
              </Text>
              <View style={styles.patternContainer}>
                {(Object.entries(PATTERN_TEMPLATES) as [PatternTemplateKey, typeof PATTERN_TEMPLATES[PatternTemplateKey]][]).map(([key, template]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.patternOption,
                      formData.selectedPattern === key && styles.selectedPattern,
                    ]}
                    onPress={() => setFormData({...formData, selectedPattern: key})}>
                    <Text style={[
                      styles.patternName,
                      formData.selectedPattern === key && styles.selectedPatternText,
                    ]}>
                      {template.name}
                    </Text>
                    <Text style={[
                      styles.patternDesc,
                      formData.selectedPattern === key && styles.selectedPatternText,
                    ]}>
                      {template.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pattern Duration Selector */}
              <View style={styles.durationContainer}>
                <Text style={styles.label}>Duration</Text>
                <View style={styles.durationOptions}>
                  {[3, 6, 12].map((months) => (
                    <TouchableOpacity
                      key={months}
                      style={[
                        styles.durationOption,
                        formData.patternDurationMonths === months && styles.selectedDuration,
                      ]}
                      onPress={() => setFormData({...formData, patternDurationMonths: months})}>
                      <Text style={[
                        styles.durationText,
                        formData.patternDurationMonths === months && styles.selectedDurationText,
                      ]}>
                        {months} months
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Pattern Preview */}
              {estimatedShiftCount > 0 && (
                <View style={styles.previewContainer}>
                  <View style={styles.previewHeader}>
                    <Text style={styles.previewTitle}>📅 Pattern Preview</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{estimatedShiftCount} shifts</Text>
                    </View>
                  </View>
                  <Text style={styles.previewSubtitle}>Next 30 days:</Text>
                  <View style={styles.previewDates}>
                    {patternPreviewDates.slice(0, 14).map((date, index) => (
                      <View key={index} style={styles.previewDate}>
                        <Text style={styles.previewDateText}>{format(date, 'd')}</Text>
                        <Text style={styles.previewDateDay}>{format(date, 'EEE')}</Text>
                      </View>
                    ))}
                    {patternPreviewDates.length > 14 && (
                      <View style={styles.previewDate}>
                        <Text style={styles.previewMoreText}>+{patternPreviewDates.length - 14}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </>
          )}
        </View>

        {/* Notes Field */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={formData.notes}
            onChangeText={(text) => setFormData({...formData, notes: text})}
            placeholder="Add any additional notes..."
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {formData.notes.length}/500
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabledButton]}
            onPress={handleSave}
            disabled={loading}>
            {creatingPattern ? (
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <ActivityIndicator size="small" color="#FFFFFF" style={{marginRight: 8}} />
                <Text style={styles.saveButtonText}>Creating Pattern...</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>
                {loading ? 'Creating...' : formData.usePattern ? `Create ${estimatedShiftCount} Shifts` : 'Create Shift'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  form: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2C3E50',
  },
  inputError: {
    borderColor: '#E74C3C',
    backgroundColor: '#FDF2F2',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    marginTop: 4,
  },
  dateDisplay: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  shiftTypeContainer: {
    gap: 8,
  },
  shiftTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedShiftType: {
    borderColor: '#FFFFFF',
    transform: [{scale: 1.02}],
  },
  shiftTypeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  shiftTypeLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  patternDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  patternContainer: {
    gap: 8,
  },
  patternOption: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
  },
  selectedPattern: {
    borderColor: '#3498DB',
    backgroundColor: '#EBF3FD',
  },
  patternName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  patternDesc: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  selectedPatternText: {
    color: '#3498DB',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  characterCount: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7F8C8D',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3498DB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#BDC3C7',
  },
  // New pattern preview styles
  durationContainer: {
    marginTop: 16,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  durationOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  selectedDuration: {
    borderColor: '#6366F1',
    backgroundColor: '#F0F0FF',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  selectedDurationText: {
    color: '#6366F1',
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  countBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  previewSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  previewDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewDate: {
    backgroundColor: '#FFFFFF',
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  previewDateDay: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  previewMoreText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },
});
