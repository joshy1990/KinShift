import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList, Shift, HouseholdMember} from '@/types';
import {format, addDays, startOfDay, endOfDay, isSameDay} from 'date-fns';
import {shiftService} from '@/services/shift.service';
import {householdService} from '@/services/household.service';
import {getShiftColor} from '@/utils/shiftColors';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';
import {useAuth} from '@/contexts/AuthContext';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<CalendarStackParamList, 'TwoWeekView'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_COLUMN_WIDTH = 65;
const NAME_COLUMN_WIDTH = 120;

/** Safely convert a shift startTime (Date or Firestore Timestamp) to a JS Date */
const toDate = (value: any): Date => {
  if (value && typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000);
  }
  return new Date(value);
};

export const TwoWeekViewScreen: React.FC<Props> = ({navigation}) => {
  const currentHouseholdId = useCurrentHouseholdId();
  const {user} = useAuth();
  const insets = useSafeAreaInsets();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  
  // Generate 14-day date range
  const dateRange = Array.from({length: 14}, (_, i) => addDays(startDate, i));
  
  // Fetch real household members
  useEffect(() => {
    if (!currentHouseholdId) {
      setMembers([]);
      return;
    }
    householdService.getHouseholdMembers(currentHouseholdId)
      .then(setMembers)
      .catch((err) => {
        console.warn('[TwoWeekView] Failed to load members:', err);
        setMembers([]);
      });
  }, [currentHouseholdId]);
  
  // Load shifts for the 14-day period
  useEffect(() => {
    if (!currentHouseholdId) {
      return;
    }

    const endDate = addDays(startDate, 13);
    
    try {
      const unsubscribe = shiftService.listenToHouseholdShifts(
        currentHouseholdId,
        startOfDay(startDate),
        endOfDay(endDate),
        (updatedShifts: Shift[]) => {
          setShifts(updatedShifts);
        }
      );
      
      return () => {
        if (unsubscribe) unsubscribe();
      };
    } catch (error) {
      console.error('Error subscribing to shifts:', error);
      setShifts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, currentHouseholdId]);
  
  // Get shifts for a specific user and date
  const getShiftsForUserAndDate = (userId: string, date: Date): Shift[] => {
    return shifts.filter(shift => 
      shift.ownerId === userId &&
      isSameDay(toDate(shift.startTime), date)
    );
  };
  
  // Navigate to previous/next 14 days
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = addDays(startDate, direction === 'next' ? 14 : -14);
    setStartDate(newDate);
  };
  
  // Get user initials
  const getUserInitials = (name: string): string => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return names[0][0].toUpperCase();
  };
  
  // Analyze coverage for a date
  const analyzeCoverage = (date: Date): {
    working: number;
    gap: boolean;
    overlap: boolean;
  } => {
    const shiftsOnDate = shifts.filter(shift =>
      isSameDay(toDate(shift.startTime), date)
    );
    
    const uniqueUsers = new Set(shiftsOnDate.map(s => s.ownerId));
    const working = uniqueUsers.size;
    
    return {
      working,
      gap: working === 0,
      overlap: working > 1,
    };
  };
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigatePeriod('prev')}>
          <Text style={styles.navButtonText}>← Prev</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {format(startDate, 'MMM d')} - {format(addDays(startDate, 13), 'MMM d, yyyy')}
        </Text>
        
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigatePeriod('next')}>
          <Text style={styles.navButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: '#EF4444'}]} />
          <Text style={styles.legendText}>Gap (no coverage)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: '#10B981'}]} />
          <Text style={styles.legendText}>Good coverage</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, {backgroundColor: '#F59E0B'}]} />
          <Text style={styles.legendText}>Overlap (2+ people)</Text>
        </View>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.dayColumnsContainer}>
          {/* Day columns - days across top with shifts underneath */}
          {dateRange.map((date, index) => {
            const dayShifts = shifts.filter(shift =>
              isSameDay(toDate(shift.startTime), date)
            );
            const coverage = analyzeCoverage(date);
            let coverageColor = '#374151'; // Default gray
            if (coverage.gap) coverageColor = '#EF4444'; // Red for gaps
            else if (coverage.overlap) coverageColor = '#F59E0B'; // Orange for overlap
            else if (coverage.working > 0) coverageColor = '#10B981'; // Green for good
            
            return (
              <TouchableOpacity
                key={index}
                style={[styles.dayColumn, {borderBottomColor: coverageColor}]}
                onPress={() => navigation.navigate('DayDetail', {date: format(date, 'yyyy-MM-dd')})}>
                {/* Day header */}
                <View style={styles.dayHeader}>
                  <Text style={styles.dayOfWeek}>{format(date, 'EEE')}</Text>
                  <Text style={styles.dayDate}>{format(date, 'd')}</Text>
                  <Text style={[styles.coverageCountBadge, {backgroundColor: coverageColor}]}>
                    {coverage.working}
                  </Text>
                </View>
                
                {/* Shifts for this day */}
                <View style={styles.dayShiftsContainer}>
                  {dayShifts.length > 0 ? (
                    dayShifts.map((shift) => {
                      const member = members.find(m => m.userId === shift.ownerId);
                      return (
                        <TouchableOpacity
                          key={shift.id}
                          style={[
                            styles.dayShiftCard,
                            {backgroundColor: getShiftColor(shift, user?.id || '')},
                          ]}
                          onPress={() => navigation.navigate('ShiftDetail', {shiftId: shift.id})}>
                          <Text style={styles.dayShiftMember} numberOfLines={1}>
                            {member?.name.split(' ')[0] || 'Unknown'}
                          </Text>
                          <Text style={styles.dayShiftTime}>
                            {format(toDate(shift.startTime), 'HH:mm')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <TouchableOpacity
                      style={styles.dayEmptyCell}
                      onPress={() => navigation.navigate('AddShift', {date})}>
                      <Text style={styles.dayEmptyCellText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      
      {/* Summary footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Shifts</Text>
          <Text style={styles.summaryValue}>{shifts.length}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Coverage Gaps</Text>
          <Text style={[styles.summaryValue, {color: '#EF4444'}]}>
            {dateRange.filter(d => analyzeCoverage(d).gap).length}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Overlaps</Text>
          <Text style={[styles.summaryValue, {color: '#F59E0B'}]}>
            {dateRange.filter(d => analyzeCoverage(d).overlap).length}
          </Text>
        </View>
      </View>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2A2A3E',
    borderRadius: 6,
  },
  navButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  dayColumnsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  dayColumn: {
    width: DAY_COLUMN_WIDTH + 20,
    borderLeftWidth: 4,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderLeftColor: '#374151',
  },
  dayHeader: {
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  dayOfWeek: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
    marginBottom: 6,
  },
  coverageCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverageCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dayShiftsContainer: {
    gap: 6,
  },
  dayShiftCard: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  dayShiftMember: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  dayShiftTime: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dayEmptyCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  dayEmptyCellText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#374151',
    opacity: 0.4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A2E',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3E',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
