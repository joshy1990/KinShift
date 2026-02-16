/**
 * ShiftTypePicker Component
 * Beautiful UI for selecting shift types with visual feedback
 * Supports quick access types and full type list
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/styles/theme';
import { ShiftType } from '@/types';
import { 
  getShiftTypeColor, 
  getShiftTypeName,
  getShiftTypeEmoji,
  getQuickShiftTypes,
  getAllShiftTypes,
  getShiftTypeDescription
} from '@/utils/shiftTypeHelpers';

interface ShiftTypePickerProps {
  selectedType: ShiftType;
  onSelectType: (type: ShiftType) => void;
  quickAccessOnly?: boolean; // Only show quick access types (Day, Night, Holiday, OFF)
  disabled?: boolean;
}

export const ShiftTypePicker: React.FC<ShiftTypePickerProps> = ({
  selectedType,
  onSelectType,
  quickAccessOnly = false,
  disabled = false
}) => {
  const [showFullPicker, setShowFullPicker] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Get types to display
  const typesToShow = quickAccessOnly ? getQuickShiftTypes() : getAllShiftTypes();
  
  return (
    <>
      {/* Quick Selection Grid */}
      <View style={styles.container}>
        <Text style={styles.label}>Shift Type</Text>
        
        <View style={styles.grid}>
          {typesToShow.map((type) => {
            const isSelected = type === selectedType;
            const color = getShiftTypeColor(type);
            
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  isSelected && styles.typeButtonSelected,
                  { backgroundColor: color }
                ]}
                onPress={() => onSelectType(type)}
                disabled={disabled}
                accessibilityLabel={`Select ${getShiftTypeName(type)}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
              >
                <Text style={styles.emoji}>{getShiftTypeEmoji(type)}</Text>
                <Text 
                  style={[
                    styles.typeName,
                    (type === 'off' || type === 'holiday') ? styles.darkText : styles.lightText
                  ]}
                  numberOfLines={2}
                >
                  {getShiftTypeName(type)}
                </Text>
              </TouchableOpacity>
            );
          })}
          
          {quickAccessOnly && (
            <TouchableOpacity
              style={[styles.typeButton, styles.moreButton]}
              onPress={() => setShowFullPicker(true)}
              disabled={disabled}
              accessibilityLabel="Show more shift types"
              accessibilityRole="button"
            >
              <Text style={styles.moreText}>•••</Text>
              <Text style={styles.moreLabel}>More</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Show description for selected type */}
        <Text style={styles.description}>
          {getShiftTypeDescription(selectedType)}
        </Text>
      </View>
      
      {/* Full Picker Modal */}
      {quickAccessOnly && (
        <Modal
          visible={showFullPicker}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFullPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Shift Type</Text>
                <TouchableOpacity
                  onPress={() => setShowFullPicker(false)}
                  style={styles.closeButton}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.modalGrid}>
                  {getAllShiftTypes().map((type) => {
                    const isSelected = type === selectedType;
                    const color = getShiftTypeColor(type);
                    
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.modalTypeButton,
                          isSelected && styles.modalTypeButtonSelected,
                        ]}
                        onPress={() => {
                          onSelectType(type);
                          setShowFullPicker(false);
                        }}
                        accessibilityLabel={`Select ${getShiftTypeName(type)}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View 
                          style={[styles.modalColorBox, { backgroundColor: color }]}
                        >
                          <Text style={styles.modalEmoji}>
                            {getShiftTypeEmoji(type)}
                          </Text>
                        </View>
                        <View style={styles.modalTypeInfo}>
                          <Text style={styles.modalTypeName}>
                            {getShiftTypeName(type)}
                          </Text>
                          <Text style={styles.modalTypeDescription} numberOfLines={2}>
                            {getShiftTypeDescription(type)}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '22%',
    maxWidth: '24%',
    aspectRatio: 1.2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  typeButtonSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  typeName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  lightText: {
    color: '#FFFFFF',
  },
  darkText: {
    color: '#000000',
  },
  moreButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreText: {
    fontSize: 24,
    color: colors.text,
    fontWeight: 'bold',
  },
  moreLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.text,
  },
  modalScroll: {
    padding: spacing.lg,
  },
  modalGrid: {
    gap: spacing.sm,
  },
  modalTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalTypeButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceLight,
  },
  modalColorBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  modalEmoji: {
    fontSize: 24,
  },
  modalTypeInfo: {
    flex: 1,
  },
  modalTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalTypeDescription: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  checkmark: {
    fontSize: 24,
    color: colors.primary,
    fontWeight: 'bold',
  },
});
