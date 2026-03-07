import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format, addDays, startOfToday } from 'date-fns';
import { spacing, typography, borderRadius } from '@/utils/responsive';

interface ShiftType {
  id: string;
  name: string;
  shortCode: string;
  color: string;
  startTime: string;
  endTime: string;
  isRestDay?: boolean;
}

interface PatternCycle {
  shifts: (ShiftType | null)[];
  cycleDays: number;
}

interface ShiftPatternConfig {
  id: string;
  name: string;
  description: string;
  cycle: PatternCycle;
  startDate: Date;
  repeatForever: boolean;
  endDate?: Date;
  rotationWeeks?: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (pattern: ShiftPatternConfig) => void;
  existingPattern?: ShiftPatternConfig;
}

const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  { id: 'day', name: 'Day Shift', shortCode: 'D', color: '#10B981', startTime: '08:00', endTime: '16:00' },
  { id: 'night', name: 'Night Shift', shortCode: 'N', color: '#3B82F6', startTime: '20:00', endTime: '06:00' },
  { id: 'evening', name: 'Evening Shift', shortCode: 'E', color: '#F59E0B', startTime: '14:00', endTime: '22:00' },
  { id: 'rest', name: 'Rest Day', shortCode: 'R', color: '#6B7280', startTime: '00:00', endTime: '00:00', isRestDay: true },
];

const PATTERN_TEMPLATES = [
  {
    name: '4 on 4 off (Days)',
    cycle: { shifts: ['day', 'day', 'day', 'day', null, null, null, null], cycleDays: 8 }
  },
  {
    name: '4 on 4 off (Nights)',
    cycle: { shifts: ['night', 'night', 'night', 'night', null, null, null, null], cycleDays: 8 }
  },
  {
    name: '3 on 3 off',
    cycle: { shifts: ['day', 'day', 'day', null, null, null], cycleDays: 6 }
  },
  {
    name: '2 Days, 4 Nights, 4 Off',
    cycle: { shifts: ['day', 'day', 'night', 'night', 'night', 'night', null, null, null, null], cycleDays: 10 }
  },
  {
    name: 'Continental (4 team)',
    cycle: { shifts: ['day', 'day', 'night', 'night', null, null, null], cycleDays: 7 }
  },
  {
    name: 'Pitman (2-3-2)',
    cycle: { shifts: ['day', 'day', null, null, 'day', 'day', 'day', null], cycleDays: 8 }
  },
];

const { width } = Dimensions.get('window');

export const ShiftPatternModal: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  existingPattern,
}) => {
  const [currentStep, setCurrentStep] = useState<'template' | 'customize' | 'schedule' | 'preview'>('template');
  const [patternName, setPatternName] = useState('');
  const [patternDescription, setPatternDescription] = useState('');
  const [customCycle, setCustomCycle] = useState<(string | null)[]>([]);
  const [cycleDays, setCycleDays] = useState(7);
  const [startDate, setStartDate] = useState(startOfToday());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [repeatForever, setRepeatForever] = useState(true);
  const [rotationWeeks, setRotationWeeks] = useState(4);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const shiftTypes = DEFAULT_SHIFT_TYPES;
  const insets = useSafeAreaInsets();

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  useEffect(() => {
    if (existingPattern) {
      setPatternName(existingPattern.name);
      setPatternDescription(existingPattern.description);
      const shifts = existingPattern.cycle.shifts.map((s: any) => s?.id || null);
      const days = existingPattern.cycle.cycleDays;
      // Ensure the cycle array always has exactly cycleDays elements
      while (shifts.length < days) shifts.push(null);
      setCustomCycle(shifts.slice(0, days));
      setCycleDays(days);
      setStartDate(existingPattern.startDate);
      setRepeatForever(existingPattern.repeatForever);
      setRotationWeeks(existingPattern.rotationWeeks || 4);
      setCurrentStep('customize');
    } else {
      // Reset state when existingPattern is cleared (switching from edit to create)
      setPatternName('');
      setPatternDescription('');
      setCustomCycle([]);
      setCycleDays(7);
      setCurrentStep('template');
    }
  }, [existingPattern]);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setPatternName(template.name);
    setPatternDescription(`${template.name} shift pattern`);
    const shifts = [...template.cycle.shifts];
    const days = template.cycle.cycleDays;
    // Ensure the cycle array always has exactly cycleDays elements
    while (shifts.length < days) shifts.push(null);
    setCustomCycle(shifts.slice(0, days));
    setCycleDays(days);
    setCurrentStep('customize');
  };

  const handleCustomizePattern = () => {
    if (!patternName.trim()) {
      Alert.alert('Error', 'Please enter a pattern name');
      return;
    }
    setCurrentStep('schedule');
  };

  const handleScheduleSetup = () => {
    setCurrentStep('preview');
  };

  const handleSavePattern = () => {
    const pattern: ShiftPatternConfig = {
      id: existingPattern?.id || `pattern_${Date.now()}`,
      name: patternName,
      description: patternDescription,
      cycle: {
        shifts: customCycle.map(shiftId => 
          shiftId ? shiftTypes.find(st => st.id === shiftId) || null : null
        ),
        cycleDays,
      },
      startDate,
      repeatForever,
      rotationWeeks,
    };

    onSave(pattern);
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep('template');
    setSelectedTemplate(null);
    setPatternName('');
    setPatternDescription('');
    setCustomCycle([]);
    setCycleDays(7);
    setStartDate(startOfToday());
    setRepeatForever(true);
    setRotationWeeks(4);
    onClose();
  };

  const addCycleDay = () => {
    setCustomCycle([...customCycle, null]);
    setCycleDays(cycleDays + 1);
  };

  const removeCycleDay = (index: number) => {
    const newCycle = [...customCycle];
    newCycle.splice(index, 1);
    setCustomCycle(newCycle);
    setCycleDays(Math.max(1, cycleDays - 1));
  };

  const updateCycleShift = (index: number, shiftId: string | null) => {
    const newCycle = [...customCycle];
    newCycle[index] = shiftId;
    setCustomCycle(newCycle);
  };

  const renderTemplateStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose Pattern Template</Text>
      <Text style={styles.stepDescription}>Select a common shift pattern or start from scratch</Text>
      
      <TouchableOpacity
        style={styles.templateCard}
        onPress={() => {
          setPatternName('Custom Pattern');
          setCustomCycle([null]);
          setCycleDays(1);
          setCurrentStep('customize');
        }}
      >
        <Text style={styles.templateName}>⚡ Custom Pattern</Text>
        <Text style={styles.templateDescription}>Create your own unique shift pattern</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Common Templates</Text>
      <ScrollView style={styles.templateList}>
        {PATTERN_TEMPLATES.map((template, index) => (
          <TouchableOpacity
            key={index}
            style={styles.templateCard}
            onPress={() => handleTemplateSelect(template)}
          >
            <Text style={styles.templateName}>{template.name}</Text>
            <View style={styles.templatePreview}>
              {template.cycle.shifts.slice(0, 8).map((shift, shiftIndex) => (
                <View
                  key={shiftIndex}
                  style={[
                    styles.previewDay,
                    {
                      backgroundColor: shift 
                        ? DEFAULT_SHIFT_TYPES.find(st => st.id === shift)?.color || '#6B7280'
                        : '#374151'
                    }
                  ]}
                >
                  <Text style={styles.previewText}>
                    {shift 
                      ? DEFAULT_SHIFT_TYPES.find(st => st.id === shift)?.shortCode || '?'
                      : 'R'
                    }
                  </Text>
                </View>
              ))}
              {template.cycle.shifts.length > 8 && (
                <Text style={styles.moreIndicator}>+{template.cycle.shifts.length - 8}</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderCustomizeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Customize Pattern</Text>
      
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Pattern Name</Text>
        <TextInput
          style={styles.textInput}
          value={patternName}
          onChangeText={setPatternName}
          placeholder="e.g., My 4 on 4 off"
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Description (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={patternDescription}
          onChangeText={setPatternDescription}
          placeholder="Brief description of this pattern"
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Shift Types</Text>
        <ScrollView horizontal style={styles.shiftTypesList}>
          {shiftTypes.map((shiftType) => (
            <View key={shiftType.id} style={styles.shiftTypeCard}>
              <View style={[styles.shiftTypeColor, { backgroundColor: shiftType.color }]} />
              <Text style={styles.shiftTypeName}>{shiftType.name}</Text>
              <Text style={styles.shiftTypeCode}>{shiftType.shortCode}</Text>
              <Text style={styles.shiftTypeTime}>
                {shiftType.isRestDay ? 'Rest Day' : `${shiftType.startTime}-${shiftType.endTime}`}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.inputLabel}>Pattern Cycle ({cycleDays} days)</Text>
          <TouchableOpacity style={styles.addButton} onPress={addCycleDay}>
            <Text style={styles.addButtonText}>+ Add Day</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal style={styles.cycleBuilder}>
          {Array.from({ length: cycleDays }, (_, index) => (
            <View key={index} style={styles.cycleDayContainer}>
              <Text style={styles.cycleDayLabel}>Day {index + 1}</Text>
              <View style={styles.cycleDaySelector}>
                {shiftTypes.map((shiftType) => (
                  <TouchableOpacity
                    key={shiftType.id}
                    style={[
                      styles.shiftOption,
                      {
                        backgroundColor: customCycle[index] === shiftType.id 
                          ? shiftType.color 
                          : '#374151'
                      }
                    ]}
                    onPress={() => updateCycleShift(index, 
                      customCycle[index] === shiftType.id ? null : shiftType.id
                    )}
                  >
                    <Text style={styles.shiftOptionText}>{shiftType.shortCode}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[
                    styles.shiftOption,
                    {
                      backgroundColor: customCycle[index] === null ? '#DC2626' : '#374151'
                    }
                  ]}
                  onPress={() => updateCycleShift(index, null)}
                >
                  <Text style={styles.shiftOptionText}>OFF</Text>
                </TouchableOpacity>
              </View>
              {cycleDays > 1 && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeCycleDay(index)}
                >
                  <Text style={styles.removeButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  const renderScheduleStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Schedule Setup</Text>
      
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Start Date</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateButtonText}>{format(startDate, 'MMM dd, yyyy')}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}
      </View>

      <View style={styles.inputSection}>
        <View style={styles.switchRow}>
          <Text style={styles.inputLabel}>Repeat Forever</Text>
          <Switch
            value={repeatForever}
            onValueChange={setRepeatForever}
            trackColor={{ false: '#374151', true: '#6366F1' }}
            thumbColor={repeatForever ? '#FFFFFF' : '#9CA3AF'}
          />
        </View>
      </View>

      {!repeatForever && (
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Rotation Weeks</Text>
          <View style={styles.numberInput}>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setRotationWeeks(Math.max(1, rotationWeeks - 1))}
            >
              <Text style={styles.numberButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.numberDisplay}>{rotationWeeks} weeks</Text>
            <TouchableOpacity
              style={styles.numberButton}
              onPress={() => setRotationWeeks(rotationWeeks + 1)}
            >
              <Text style={styles.numberButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderPreviewStep = () => {
    const previewDays = 14; // Show 2 weeks preview
    const pattern = customCycle;
    
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Preview Pattern</Text>
        <Text style={styles.stepDescription}>
          {patternName} • {cycleDays} day cycle • Starting {format(startDate, 'MMM dd')}
        </Text>
        
        <ScrollView style={styles.previewContainer}>
          {Array.from({ length: previewDays }, (_, index) => {
            const cycleIndex = index % cycleDays;
            const shiftId = pattern[cycleIndex];
            const shift = shiftId ? shiftTypes.find(st => st.id === shiftId) : null;
            const date = addDays(startDate, index);
            
            return (
              <View key={index} style={styles.previewRow}>
                <Text style={styles.previewDate}>{format(date, 'EEE MMM dd')}</Text>
                <View style={[
                  styles.previewShift,
                  { backgroundColor: shift?.color || '#374151' }
                ]}>
                  <Text style={styles.previewShiftText}>
                    {shift ? `${shift.shortCode} ${shift.name}` : 'Rest Day'}
                  </Text>
                  {shift && !shift.isRestDay && (
                    <Text style={styles.previewTime}>
                      {shift.startTime} - {shift.endTime}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'template':
        return renderTemplateStep();
      case 'customize':
        return renderCustomizeStep();
      case 'schedule':
        return renderScheduleStep();
      case 'preview':
        return renderPreviewStep();
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {existingPattern ? 'Edit Pattern' : 'New Shift Pattern'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Steps */}
        <View style={styles.progressContainer}>
          {['template', 'customize', 'schedule', 'preview'].map((step, index) => (
            <View key={step} style={styles.progressStep}>
              <View style={[
                styles.progressDot,
                {
                  backgroundColor: currentStep === step ? '#6366F1' :
                    ['template', 'customize', 'schedule', 'preview'].indexOf(currentStep) > index ? '#10B981' : '#374151'
                }
              ]}>
                <Text style={styles.progressNumber}>{index + 1}</Text>
              </View>
              {index < 3 && <View style={styles.progressLine} />}
            </View>
          ))}
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {renderCurrentStep()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {currentStep !== 'template' && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                const steps = ['template', 'customize', 'schedule', 'preview'];
                const currentIndex = steps.indexOf(currentStep);
                if (currentIndex > 0) {
                  setCurrentStep(steps[currentIndex - 1] as any);
                }
              }}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.primaryButton, { flex: currentStep === 'template' ? 1 : 0.6 }]}
            onPress={() => {
              if (currentStep === 'customize') {
                handleCustomizePattern();
              } else if (currentStep === 'schedule') {
                handleScheduleSetup();
              } else if (currentStep === 'preview') {
                handleSavePattern();
              }
            }}
          >
            <Text style={styles.primaryButtonText}>
              {currentStep === 'preview' ? 'Save Pattern' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.title,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 32,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#374151',
    marginHorizontal: spacing.sm,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.heading,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: typography.body,
    color: '#A1A1AA',
    marginBottom: spacing.xl,
  },
  templateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  templateName: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  templateDescription: {
    fontSize: typography.body,
    color: '#A1A1AA',
    marginBottom: spacing.md,
  },
  templatePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  previewDay: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  moreIndicator: {
    color: '#A1A1AA',
    fontSize: typography.caption,
    marginLeft: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  templateList: {
    maxHeight: 400,
  },
  inputSection: {
    marginBottom: spacing.xl,
  },
  inputLabel: {
    fontSize: typography.body,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shiftTypesList: {
    maxHeight: 120,
  },
  shiftTypeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginRight: spacing.md,
    minWidth: 100,
    alignItems: 'center',
  },
  shiftTypeColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: spacing.xs,
  },
  shiftTypeName: {
    fontSize: typography.caption,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  shiftTypeCode: {
    fontSize: typography.subtitle,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  shiftTypeTime: {
    fontSize: 10,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  cycleBuilder: {
    maxHeight: 200,
  },
  cycleDayContainer: {
    marginRight: spacing.md,
    alignItems: 'center',
    minWidth: 80,
  },
  cycleDayLabel: {
    fontSize: typography.caption,
    color: '#A1A1AA',
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  cycleDaySelector: {
    gap: spacing.xs,
  },
  shiftOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    minWidth: 40,
  },
  shiftOptionText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  removeButton: {
    marginTop: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  dateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  dateButtonText: {
    fontSize: typography.body,
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  numberInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  numberButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#374151',
  },
  numberButtonText: {
    color: '#FFFFFF',
    fontSize: typography.subtitle,
    fontWeight: '600',
  },
  numberDisplay: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.body,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  previewContainer: {
    maxHeight: 400,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  previewDate: {
    width: 100,
    fontSize: typography.body,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  previewShift: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.md,
  },
  previewShiftText: {
    fontSize: typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  previewTime: {
    fontSize: typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: spacing.md,
  },
  primaryButton: {
    backgroundColor: '#6366F1',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
});