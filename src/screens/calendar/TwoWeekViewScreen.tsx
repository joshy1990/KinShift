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
import {getShiftColor} from '@/utils/shiftColors';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';

type Props = NativeStackScreenProps<CalendarStackParamList, 'TwoWeekView'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const DAY_COLUMN_WIDTH = 50;
const NAME_COLUMN_WIDTH = 100;

export const TwoWeekViewScreen: React.FC<Props> = ({navigation}) => {
  const currentHouseholdId = useCurrentHouseholdId();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  
  // Generate 14-day date range
  const dateRange = Array.from({length: 14}, (_, i) => addDays(startDate, i));
  
  // Sample household members - in real app, fetch from household service
  useEffect(() => {
    const sampleMembers: HouseholdMember[] = [
      {
        userId: 'user1',
        name: 'John Doe',
        role: 'admin',
        joinedAt: new Date(),
      },
      {
        userId: 'user2',
        name: 'Jane Smith',
        role: 'member',
        joinedAt: new Date(),
      },
      {
        userId: 'user3',
        name: 'Mike Wilson',
        role: 'member',
        joinedAt: new Date(),
      },
    ];
    setMembers(sampleMembers);
  }, []);
  
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
      // Firebase not available, using sample data
      
      // Sample shifts for demo
      const sampleShifts: Shift[] = [
        {
          id: '1',
          title: 'Day Shift',
          householdId: currentHouseholdId,
          ownerId: 'user1',
          startTime: new Date(startDate.getTime() + 8 * 60 * 60 * 1000),
          endTime: new Date(startDate.getTime() + 16 * 60 * 60 * 1000),
          colorTag: '#2ECC71',
          shiftType: 'day',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastEditedBy: 'user1',
        },
      ];
      setShifts(sampleShifts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);
  
  // Get shifts for a specific user and date
  const getShiftsForUserAndDate = (userId: string, date: Date): Shift[] => {
    return shifts.filter(shift => 
      shift.ownerId === userId &&
      isSameDay(new Date(shift.startTime), date)
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
      isSameDay(new Date(shift.startTime), date)
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
        <View>
          {/* Date header row */}
          <View style={styles.dateHeaderRow}>
            <View style={[styles.cell, styles.nameCell]}>
              <Text style={styles.nameHeaderText}>Member</Text>
            </View>
            {dateRange.map((date, index) => {
              const coverage = analyzeCoverage(date);
              let coverageColor = '#374151'; // Default gray
              if (coverage.gap) coverageColor = '#EF4444'; // Red for gaps
              else if (coverage.overlap) coverageColor = '#F59E0B'; // Orange for overlap
              else if (coverage.working > 0) coverageColor = '#10B981'; // Green for good
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.cell, styles.dateCell, {borderBottomColor: coverageColor}]}
                  onPress={() => navigation.navigate('DayDetail', {date: format(date, 'yyyy-MM-dd')})}>
                  <Text style={styles.dateHeaderDay}>{format(date, 'EEE')}</Text>
                  <Text style={styles.dateHeaderDate}>{format(date, 'd')}</Text>
                  <Text style={[styles.coverageCount, {color: coverageColor}]}>
                    {coverage.working}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Member rows */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {members.map((member) => (
              <View key={member.userId} style={styles.memberRow}>
                <View style={[styles.cell, styles.nameCell]}>
                  <View style={styles.memberInfo}>
                    <View style={styles.initialsCircle}>
                      <Text style={styles.initialsText}>
                        {getUserInitials(member.name)}
                      </Text>
                    </View>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.name}
                    </Text>
                  </View>
                </View>
                
                {dateRange.map((date, index) => {
                  const userShifts = getShiftsForUserAndDate(member.userId, date);
                  const hasShift = userShifts.length > 0;
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.cell, styles.shiftCell]}
                      onPress={() => {
                        if (hasShift) {
                          navigation.navigate('ShiftDetail', {shiftId: userShifts[0].id});
                        } else {
                          navigation.navigate('AddShift', {date});
                        }
                      }}>
                      {hasShift ? (
                        <View style={styles.shiftIndicators}>
                          {userShifts.map((shift, idx) => (
                            <View
                              key={shift.id}
                              style={[
                                styles.shiftBlock,
                                {backgroundColor: getShiftColor(shift, shift.ownerId)},
                                idx > 0 && {marginTop: 2},
                              ]}>
                              <Text style={styles.shiftBlockText}>
                                {format(new Date(shift.startTime), 'HH:mm')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyCell}>
                          <Text style={styles.emptyCellText}>+</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
      
      {/* Summary footer */}
      <View style={styles.footer}>
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
  dateHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 2,
    borderBottomColor: '#2A2A3E',
  },
  memberRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  cell: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1A1A2E',
  },
  nameCell: {
    width: NAME_COLUMN_WIDTH,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 12,
  },
  nameHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dateCell: {
    width: DAY_COLUMN_WIDTH,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 3,
  },
  dateHeaderDay: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  dateHeaderDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  coverageCount: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  initialsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  initialsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  memberName: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
  },
  shiftCell: {
    width: DAY_COLUMN_WIDTH,
    minHeight: 50,
    backgroundColor: '#0F0F23',
  },
  shiftIndicators: {
    flex: 1,
    width: '100%',
  },
  shiftBlock: {
    flex: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 2,
  },
  shiftBlockText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCellText: {
    fontSize: 20,
    color: '#374151',
    opacity: 0.3,
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
