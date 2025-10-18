import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { format, addDays, startOfToday } from 'date-fns';
import { spacing, typography, borderRadius } from '@/utils/responsive';

interface SimpleShift {
  day: number; // 1-7 for Monday-Sunday
  type: 'day' | 'night' | 'afternoon' | 'off';
  startTime: string;
  endTime: string;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (shifts: SimpleShift[], patternName: string) => void;
}

const SHIFT_TYPES = [
  { id: 'day', name: 'Day Shift', color: '#10B981', defaultStart: '08:00', defaultEnd: '16:00' },
  { id: 'afternoon', name: 'Afternoon', color: '#F59E0B', defaultStart: '14:00', defaultEnd: '22:00' },
  { id: 'night', name: 'Night Shift', color: '#3B82F6', defaultStart: '22:00', defaultEnd: '06:00' },
  { id: 'off', name: 'Day Off', color: '#6B7280', defaultStart: '--:--', defaultEnd: '--:--' },
];

const DAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 7, name: 'Sunday', short: 'Sun' },
];

const QUICK_TEMPLATES = [
  {
    name: '4 Days On, 4 Days Off',
    shifts: [
      { day: 1, type: 'day' as const, startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
      { day: 2, type: 'day' as const, startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
      { day: 3, type: 'day' as const, startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
      { day: 4, type: 'day' as const, startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
      { day: 5, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 6, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 7, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 1, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
    ]
  },
  {
    name: 'Monday to Friday (9-5)',
    shifts: [
      { day: 1, type: 'day' as const, startTime: '09:00', endTime: '17:00', label: 'Day Shift' },
      { day: 2, type: 'day' as const, startTime: '09:00', endTime: '17:00', label: 'Day Shift' },
      { day: 3, type: 'day' as const, startTime: '09:00', endTime: '17:00', label: 'Day Shift' },
      { day: 4, type: 'day' as const, startTime: '09:00', endTime: '17:00', label: 'Day Shift' },
      { day: 5, type: 'day' as const, startTime: '09:00', endTime: '17:00', label: 'Day Shift' },
      { day: 6, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 7, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
    ]
  },
  {
    name: '2 Days, 4 Nights, 4 Off',
    shifts: [
      { day: 1, type: 'day' as const, startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
      { day: 2, type: 'day' as const, startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
      { day: 3, type: 'night' as const, startTime: '22:00', endTime: '06:00', label: 'Night Shift' },
      { day: 4, type: 'night' as const, startTime: '22:00', endTime: '06:00', label: 'Night Shift' },
      { day: 5, type: 'night' as const, startTime: '22:00', endTime: '06:00', label: 'Night Shift' },
      { day: 6, type: 'night' as const, startTime: '22:00', endTime: '06:00', label: 'Night Shift' },
      { day: 7, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 1, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 2, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
      { day: 3, type: 'off' as const, startTime: '--:--', endTime: '--:--', label: 'Day Off' },
    ]
  }
];

export const SimplePatternModal: React.FC<Props> = ({ visible, onClose, onSave }) => {
  const [patternName, setPatternName] = useState('');
  const [showTemplates, setShowTemplates] = useState(true);
  const [shifts, setShifts] = useState<SimpleShift[]>([
    { day: 1, type: 'day', startTime: '08:00', endTime: '16:00', label: 'Day Shift' },
  ]);

  const handleClose = () => {
    setPatternName('');
    setShowTemplates(true);
    setShifts([{ day: 1, type: 'day', startTime: '08:00', endTime: '16:00', label: 'Day Shift' }]);
    onClose();
  };

  const selectTemplate = (template: any) => {
    setPatternName(template.name);
    setShifts(template.shifts);
    setShowTemplates(false);
  };

  const startCustom = () => {
    setPatternName('My Custom Pattern');
    setShifts([{ day: 1, type: 'day', startTime: '08:00', endTime: '16:00', label: 'Day Shift' }]);
    setShowTemplates(false);
  };

  const handleSave = () => {
    if (!patternName.trim()) {
      Alert.alert('Error', 'Please enter a pattern name');
      return;
    }
    
    if (shifts.length === 0) {
      Alert.alert('Error', 'Please add at least one shift');
      return;
    }

    onSave(shifts, patternName);
    handleClose();
  };

  const addShift = () => {
    const nextDay = shifts.length > 0 ? (shifts[shifts.length - 1].day % 7) + 1 : 1;
    setShifts([
      ...shifts,
      { day: nextDay, type: 'day', startTime: '08:00', endTime: '16:00', label: 'Day Shift' }
    ]);
  };

  const removeShift = (index: number) => {
    if (shifts.length > 1) {
      const newShifts = [...shifts];
      newShifts.splice(index, 1);
      setShifts(newShifts);
    }
  };

  const updateShift = (index: number, field: keyof SimpleShift, value: any) => {
    const newShifts = [...shifts];
    newShifts[index] = { ...newShifts[index], [field]: value };
    
    // Auto-update times when shift type changes
    if (field === 'type') {
      const shiftType = SHIFT_TYPES.find(t => t.id === value);
      if (shiftType && value !== 'off') {
        newShifts[index].startTime = shiftType.defaultStart;
        newShifts[index].endTime = shiftType.defaultEnd;
        newShifts[index].label = shiftType.name;
      } else if (value === 'off') {
        newShifts[index].startTime = '--:--';
        newShifts[index].endTime = '--:--';
        newShifts[index].label = 'Day Off';
      }
    }
    
    setShifts(newShifts);
  };

  const renderShiftRow = (shift: SimpleShift, index: number) => {
    const shiftType = SHIFT_TYPES.find(t => t.id === shift.type);
    const day = DAYS.find(d => d.id === shift.day);

    return (
      <View key={index} style={styles.shiftRow}>
        <Text style={styles.shiftNumber}>{index + 1}</Text>
        
        {/* Day Selector */}
        <View style={styles.daySelector}>
          <Text style={styles.fieldLabel}>Day</Text>
          <View style={styles.dayGrid}>
            {DAYS.map((dayOption) => (
              <TouchableOpacity
                key={dayOption.id}
                style={[
                  styles.dayOption,
                  { backgroundColor: shift.day === dayOption.id ? '#6366F1' : '#374151' }
                ]}
                onPress={() => updateShift(index, 'day', dayOption.id)}
              >
                <Text style={styles.dayOptionText}>{dayOption.short}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Shift Type Selector */}
        <View style={styles.typeSelector}>
          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.typeGrid}>
            {SHIFT_TYPES.map((typeOption) => (
              <TouchableOpacity
                key={typeOption.id}
                style={[
                  styles.typeOption,
                  { 
                    backgroundColor: shift.type === typeOption.id ? typeOption.color : '#374151',
                    borderColor: shift.type === typeOption.id ? typeOption.color : 'transparent'
                  }
                ]}
                onPress={() => updateShift(index, 'type', typeOption.id)}
              >
                <Text style={styles.typeOptionText}>{typeOption.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time Inputs */}
        {shift.type !== 'off' && (
          <View style={styles.timeInputs}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>Start</Text>
              <TextInput
                style={styles.timeInput}
                value={shift.startTime}
                onChangeText={(text) => updateShift(index, 'startTime', text)}
                placeholder="08:00"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.timeSeparator}>—</Text>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>End</Text>
              <TextInput
                style={styles.timeInput}
                value={shift.endTime}
                onChangeText={(text) => updateShift(index, 'endTime', text)}
                placeholder="16:00"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {/* Remove Button */}
        {shifts.length > 1 && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeShift(index)}
          >
            <Text style={styles.removeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    );
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
          <Text style={styles.headerTitle}>Create Shift Pattern</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {showTemplates ? (
            <>
              {/* Quick Templates */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Choose a Template</Text>
                <Text style={styles.instructionsText}>
                  Pick a common pattern or create your own custom schedule.
                </Text>
                
                {QUICK_TEMPLATES.map((template, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.templateCard}
                    onPress={() => selectTemplate(template)}
                  >
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDescription}>
                      {template.shifts.filter(s => s.type !== 'off').length} work days, {template.shifts.filter(s => s.type === 'off').length} days off
                    </Text>
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity
                  style={[styles.templateCard, styles.customCard]}
                  onPress={startCustom}
                >
                  <Text style={styles.templateName}>⚡ Create Custom Pattern</Text>
                  <Text style={styles.templateDescription}>
                    Build your own unique schedule from scratch
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Pattern Name */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Pattern Name</Text>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setShowTemplates(true)}
                  >
                    <Text style={styles.backButtonText}>← Back to Templates</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.nameInput}
                  value={patternName}
                  onChangeText={setPatternName}
                  placeholder="e.g., My Work Schedule"
                  placeholderTextColor="#6B7280"
                />
              </View>

              {/* Instructions */}
              <View style={styles.section}>
                <Text style={styles.instructionsText}>
                  Add your shifts below. The app will repeat this pattern automatically.
                </Text>
              </View>

          {/* Shifts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Shifts</Text>
              <TouchableOpacity style={styles.addButton} onPress={addShift}>
                <Text style={styles.addButtonText}>+ Add Shift</Text>
              </TouchableOpacity>
            </View>

            {shifts.map((shift, index) => renderShiftRow(shift, index))}
          </View>

          {/* Preview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pattern Preview (Next 2 weeks)</Text>
            <View style={styles.preview}>
              {Array.from({ length: 14 }, (_, dayIndex) => {
                const cycleDay = (dayIndex % shifts.length);
                const shift = shifts[cycleDay];
                const date = addDays(startOfToday(), dayIndex);
                const shiftType = SHIFT_TYPES.find(t => t.id === shift?.type);
                
                return (
                  <View key={dayIndex} style={styles.previewDay}>
                    <Text style={styles.previewDate}>{format(date, 'MMM dd')}</Text>
                    <View style={[
                      styles.previewShift,
                      { backgroundColor: shiftType?.color || '#374151' }
                    ]}>
                      <Text style={styles.previewShiftText}>
                        {shift?.type === 'off' ? 'Off' : shift?.label}
                      </Text>
                      {shift?.type !== 'off' && (
                        <Text style={styles.previewTime}>
                          {shift?.startTime} - {shift?.endTime}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
            </>
          )}
        </ScrollView>
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
    paddingHorizontal: spacing.md,
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
  saveButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.subtitle,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  instructionsText: {
    fontSize: typography.body,
    color: '#A1A1AA',
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '600',
  },
  shiftRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shiftNumber: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: '#6366F1',
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '700',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  fieldLabel: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: '#A1A1AA',
    marginBottom: spacing.xs,
  },
  daySelector: {
    marginBottom: spacing.md,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    minWidth: 40,
    alignItems: 'center',
    flex: 1,
  },
  dayOptionText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  typeSelector: {
    marginBottom: spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  typeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  typeOptionText: {
    color: '#FFFFFF',
    fontSize: typography.caption,
    fontWeight: '600',
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  timeField: {
    flex: 1,
  },
  timeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.body,
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  timeSeparator: {
    color: '#A1A1AA',
    fontSize: typography.body,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  preview: {
    gap: spacing.sm,
  },
  previewDay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  previewDate: {
    width: 60,
    fontSize: typography.caption,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  previewShift: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  previewShiftText: {
    fontSize: typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  previewTime: {
    fontSize: typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  templateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  customCard: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
  },
  backButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.sm,
  },
  backButtonText: {
    fontSize: typography.caption,
    color: '#6366F1',
    fontWeight: '600',
  },
});