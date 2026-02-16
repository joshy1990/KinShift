/**
 * CalendarLegend Component
 * Shows shift type color key on calendar screens
 * Optionally shows household member color assignments
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

interface HouseholdMemberLegend {
  userId: string;
  name: string;
  color: string;
}

interface CalendarLegendProps {
  defaultExpanded?: boolean;
  activeTypes?: ShiftType[]; // Only show these types if provided
  householdMembers?: HouseholdMemberLegend[]; // Household member colors
}

export const CalendarLegend: React.FC<CalendarLegendProps> = ({ 
  defaultExpanded = true,
  activeTypes,
  householdMembers,
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
        <View>
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

          {/* Household Members */}
          {householdMembers && householdMembers.length > 0 && (
            <View style={styles.membersSection}>
              <Text style={styles.membersSectionTitle}>Household Members</Text>
              <View style={styles.membersGrid}>
                {/* Current user */}
                <View style={styles.memberItem}>
                  <View style={[styles.memberColorBox, { backgroundColor: colors.primary }]}>
                    <Text style={styles.memberInitialText}>You</Text>
                  </View>
                  <Text style={styles.memberNameText} numberOfLines={1}>
                    Your shifts (by type)
                  </Text>
                </View>
                {/* Other members */}
                {householdMembers.map((member) => (
                  <View key={member.userId} style={styles.memberItem}>
                    <View style={[styles.memberColorBox, { backgroundColor: member.color }]}>
                      <Text style={styles.memberInitialText}>
                        {member.name[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={styles.memberNameText} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
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
  membersSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#2A2A3E',
  },
  membersSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.xs,
    minWidth: 110,
  },
  memberColorBox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  memberInitialText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberNameText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
});
