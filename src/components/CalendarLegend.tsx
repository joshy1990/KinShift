/**
 * CalendarLegend Component
 * Shows shift type color key on calendar screens
 * Accessible and collapsible for space efficiency
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/styles/theme';
import { 
  getAllShiftTypes, 
  getShiftTypeColor, 
  getShiftTypeLabel, 
  getShiftTypeName,
  getShiftTypeEmoji 
} from '@/utils/shiftTypeHelpers';
import { ShiftType } from '@/types';

interface CalendarLegendProps {
  defaultExpanded?: boolean;
  activeTypes?: ShiftType[]; // Only show these types if provided
}

export const CalendarLegend: React.FC<CalendarLegendProps> = ({ 
  defaultExpanded = true,
  activeTypes 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Get shift types to display
  const shiftTypes = activeTypes || getAllShiftTypes();
  
  return (
    <View style={styles.container}>
      {/* Header with toggle */}
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
        accessibilityLabel={isExpanded ? 'Collapse legend' : 'Expand legend'}
        accessibilityRole="button"
      >
        <Text style={styles.headerText}>
          Legend {isExpanded ? '▼' : '▶'}
        </Text>
        <Text style={styles.headerSubtext}>
          {isExpanded ? 'Tap to hide' : 'Tap to show shift colors'}
        </Text>
      </TouchableOpacity>
      
      {/* Legend Items */}
      {isExpanded && (
        <View style={styles.grid}>
          {shiftTypes.map((type) => (
            <View key={type} style={styles.legendItem}>
              <View 
                style={[
                  styles.colorBox, 
                  { backgroundColor: getShiftTypeColor(type) }
                ]}
              >
                <Text style={[
                  styles.labelText,
                  type === 'off' || type === 'holiday' ? styles.darkText : styles.lightText
                ]}>
                  {getShiftTypeLabel(type)}
                </Text>
              </View>
              <View style={styles.labelContainer}>
                <Text style={styles.emojiText}>
                  {getShiftTypeEmoji(type)}
                </Text>
                <Text style={styles.nameText} numberOfLines={1}>
                  {getShiftTypeName(type)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'column',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.sm,
    minWidth: 120,
  },
  colorBox: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  labelText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  lightText: {
    color: '#FFFFFF',
  },
  darkText: {
    color: '#000000',
  },
  labelContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  emojiText: {
    fontSize: 12,
    marginBottom: 2,
  },
  nameText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '500',
  },
});
