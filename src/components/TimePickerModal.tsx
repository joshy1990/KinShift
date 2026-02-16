/**
 * TimePickerModal — Shared scrollable time picker used across the app.
 *
 * Renders a bottom-sheet-style Modal with Hour (00-23) and Minute (00-55, step 5)
 * columns, Cancel / Apply buttons, and the app's dark colour scheme.
 *
 * Usage:
 *   <TimePickerModal
 *     visible={showTimePicker}
 *     title="Select Start Time"
 *     hour={pickerHour}
 *     minute={pickerMinute}
 *     onHourChange={setPickerHour}
 *     onMinuteChange={setPickerMinute}
 *     onApply={handleApply}
 *     onCancel={() => setShowTimePicker(false)}
 *   />
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface TimePickerModalProps {
  visible: boolean;
  title?: string;
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  onApply: () => void;
  onCancel: () => void;
}

const HOURS = Array.from({length: 24}, (_, i) => i);
const MINUTES = Array.from({length: 12}, (_, i) => i * 5);

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  visible,
  title = 'Select Time',
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onApply,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.pickerContainer}>
            {/* Hour column */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Hour</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerItem, hour === h && styles.pickerItemActive]}
                    onPress={() => onHourChange(h)}>
                    <Text
                      style={[
                        styles.pickerItemText,
                        hour === h && styles.pickerItemTextActive,
                      ]}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Minute column */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>Minute</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}>
                {MINUTES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, minute === m && styles.pickerItemActive]}
                    onPress={() => onMinuteChange(m)}>
                    <Text
                      style={[
                        styles.pickerItemText,
                        minute === m && styles.pickerItemTextActive,
                      ]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={onApply}>
              <Text style={styles.applyButtonText}>Apply</Text>
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
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '60%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  pickerColumn: {
    flex: 1,
    maxWidth: 120,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 8,
  },
  pickerScroll: {
    maxHeight: 200,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2A2A3E',
    borderRadius: 12,
    backgroundColor: '#0F0F23',
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
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
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applyButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
