/**
 * CalendarViewScreen - Refactored to use ViewModel pattern
 * Pure UI component that delegates business logic to CalendarViewModel
 */

import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {CalendarStackParamList} from '@/types';
import {format, isSameDay, isToday} from 'date-fns';
import {getShiftColor, getShiftTypeIcon} from '@/utils/shiftColors';
import {getShiftTypeLabel} from '@/utils/shiftTypeHelpers';
import {getScreenBottomPadding} from '@/utils/bottomSpacing';
import {useCurrentHouseholdId} from '@/contexts/HouseholdContext';
import {useAuth} from '@/contexts/AuthContext';
import {CalendarLegend} from '@/components/CalendarLegend';
import {useCalendarViewModel} from '@/viewmodels/calendar/CalendarViewModel';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarView'>;

export const CalendarViewScreenRefactored: React.FC<Props> = ({navigation}) => {
  const {user} = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const insets = useSafeAreaInsets();

  // ViewModel provides all business logic and state
  const viewModel = useCalendarViewModel(user?.id, currentHouseholdId);
  const {state, displayDates, navigateWeek, toggleViewMode, selectDate, getShiftsForDate, getDateColorIndicators, initialize} = viewModel;

  // Initialize ViewModel with current data
  useEffect(() => {
    const cleanup = initialize(user?.id, currentHouseholdId);
    return cleanup;
  }, [user?.id, currentHouseholdId, initialize]);

  // Double-tap handling (UI-specific state, not in ViewModel)
  const [lastTapDate, setLastTapDate] = React.useState<Date | null>(null);
  const [lastTapTime, setLastTapTime] = React.useState<number>(0);

  const handleDatePress = (date: Date, dateString: string) => {
    const now = Date.now();
    const isDoubleTap = lastTapDate && isSameDay(lastTapDate, date) && now - lastTapTime < 300;

    if (isDoubleTap) {
      const dayShifts = getShiftsForDate(date);
      navigation.navigate('DayDetail', {
        date: dateString,
        shifts: dayShifts,
      });
      setLastTapDate(null);
      setLastTapTime(0);
    } else {
      selectDate(date);
      setLastTapDate(date);
      setLastTapTime(now);
    }
  };

  // Render month view cell
  const renderMonthCell = ({item: date}: {item: Date}) => {
    const dayShifts = getShiftsForDate(date);
    const colorInfo = getDateColorIndicators(date);
    const isSelected = isSameDay(date, state.selectedDate);
    const isCurrentDay = isToday(date);
    const dateString = format(date, 'yyyy-MM-dd');
    const noteCount = state.noteCounts[dateString] || 0;
    const isCurrentMonth = date.getMonth() === state.currentDate.getMonth();

    return (
      <TouchableOpacity
        style={[
          styles.monthCell,
          isSelected && styles.selectedMonthCell,
          !isCurrentMonth && styles.otherMonthCell,
        ]}
        onPress={() => handleDatePress(date, dateString)}>
        <View style={[
          styles.monthCellHeader,
          isCurrentDay && styles.todayHeader,
        ]}>
          <Text style={[
            styles.monthCellNumber,
            isCurrentDay && styles.todayText,
            !isCurrentMonth && styles.otherMonthText,
          ]}>
            {format(date, 'd')}
          </Text>
          {noteCount > 0 && (
            <View style={styles.monthNoteDot} />
          )}
        </View>
        
        {colorInfo.count > 0 && (
          <View style={styles.monthShiftIndicators}>
            {(() => {
              if (dayShifts.length === 1 && dayShifts[0].label) {
                const isCurrent = dayShifts[0].ownerId === user?.id;
                const badgeColor = getShiftColor(dayShifts[0], user?.id || '', isCurrent);
                return (
                  <View style={[styles.labelBadge, {backgroundColor: badgeColor}]}>
                    <Text style={styles.labelBadgeText} numberOfLines={1}>
                      {dayShifts[0].label}
                    </Text>
                  </View>
                );
              }

              const displayColors = colorInfo.colors.slice(0, 2);
              return (
                <>
                  {displayColors.map((color, idx) => (
                    <View
                      key={idx}
                      style={[styles.monthOwnerDot, {backgroundColor: color}]}
                    />
                  ))}
                  {colorInfo.count > 2 && (
                    <Text style={styles.monthShiftCount}>+{colorInfo.count - 2}</Text>
                  )}
                </>
              );
            })()}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Render week view cell (original detailed version would go here)
  const renderWeekCell = ({item: date}: {item: Date}) => {
    // Similar to original implementation but using viewModel data
    const dayShifts = getShiftsForDate(date);
    const isSelected = isSameDay(date, state.selectedDate);
    const isCurrentDay = isToday(date);
    const dateString = format(date, 'yyyy-MM-dd');

    return (
      <View style={styles.weekCell}>
        <TouchableOpacity
          style={[
            styles.weekCellHeader,
            isSelected && styles.selectedWeekCell,
            isCurrentDay && styles.todayCell,
          ]}
          onPress={() => handleDatePress(date, dateString)}>
          <Text style={[styles.weekDayName, isCurrentDay && styles.todayText]}>
            {format(date, 'EEE')}
          </Text>
          <Text style={[styles.weekDayNumber, isCurrentDay && styles.todayText]}>
            {format(date, 'd')}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.weekShiftsContainer}>
          {dayShifts.map((shift, index) => {
            const userName = state.users[shift.ownerId]?.name || 'Unknown';
            const isCurrent = shift.ownerId === user?.id;
            const shiftColor = getShiftColor(shift, user?.id || '', isCurrent);
            const shiftIcon = getShiftTypeIcon(shift.shiftType || 'custom');

            return (
              <TouchableOpacity
                key={shift.id || index}
                style={[styles.weekShiftBadge, {backgroundColor: shiftColor}]}
                onPress={() => navigation.navigate('ShiftDetail', {shiftId: shift.id})}>
                <Text style={styles.weekShiftIcon}>{shiftIcon}</Text>
                <View style={styles.weekShiftInfo}>
                  <Text style={styles.weekShiftTitle} numberOfLines={1}>
                    {shift.label || getShiftTypeLabel(shift.shiftType || 'custom')}
                  </Text>
                  <Text style={styles.weekShiftUser} numberOfLines={1}>
                    {userName}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
          <Text style={styles.navButtonText}>←</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={toggleViewMode}>
          <Text style={styles.headerTitle}>
            {format(state.currentDate, 'MMMM yyyy')}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
          <Text style={styles.navButtonText}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <FlatList
        data={displayDates}
        renderItem={state.viewMode === 'month' ? renderMonthCell : renderWeekCell}
        keyExtractor={(date) => date.toISOString()}
        numColumns={state.viewMode === 'month' ? 7 : 1}
        key={state.viewMode} // Force re-render when switching modes
        contentContainerStyle={styles.calendarContent}
      />

      {/* Legend */}
      <CalendarLegend />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, {bottom: getScreenBottomPadding(insets.bottom) + 16}]}
        onPress={() => navigation.navigate('AddShift')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  calendarContent: {
    padding: 8,
  },
  monthCell: {
    flex: 1,
    aspectRatio: 1,
    padding: 4,
    margin: 2,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
  },
  selectedMonthCell: {
    backgroundColor: '#2A2A4E',
  },
  otherMonthCell: {
    opacity: 0.5,
  },
  monthCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthCellNumber: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  todayHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#00D9FF',
  },
  todayText: {
    color: '#00D9FF',
    fontWeight: 'bold',
  },
  otherMonthText: {
    color: '#666',
  },
  monthNoteDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFD700',
  },
  monthShiftIndicators: {
    flexDirection: 'row',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  monthOwnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },
  monthShiftCount: {
    fontSize: 10,
    color: '#999',
  },
  labelBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  labelBadgeText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  weekCell: {
    marginBottom: 16,
  },
  weekCellHeader: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
  },
  selectedWeekCell: {
    backgroundColor: '#2A2A4E',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#00D9FF',
  },
  weekDayName: {
    color: '#FFFFFF',
    marginRight: 8,
  },
  weekDayNumber: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  weekShiftsContainer: {
    marginTop: 8,
    paddingLeft: 16,
  },
  weekShiftBadge: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  weekShiftIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  weekShiftInfo: {
    flex: 1,
  },
  weekShiftTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  weekShiftUser: {
    color: '#CCCCCC',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00D9FF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 28,
    color: '#0F0F23',
    fontWeight: 'bold',
  },
});
