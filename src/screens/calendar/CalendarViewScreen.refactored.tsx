/**
 * CalendarViewScreen — MVVM Refactored version
 *
 * This file demonstrates the MVVM architecture described in ARCHITECTURE.md.
 * It uses the CalendarViewModel to manage business logic and state,
 * keeping the component focused purely on rendering.
 *
 * STATUS: Work-in-progress. The production navigation currently points to
 * the original CalendarViewScreen.tsx. Switch the import in CalendarStack.tsx
 * when this version is ready for use.
 */
import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarStackParamList } from '@/types';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  startOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import { getShiftColor } from '@/utils/shiftColors';
import { useCurrentHouseholdId } from '@/contexts/HouseholdContext';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarLegend } from '@/components/CalendarLegend';
import { useCalendarViewModel } from '@/viewmodels/calendar/CalendarViewModel';

type Props = NativeStackScreenProps<CalendarStackParamList, 'CalendarView'>;

export const CalendarViewScreenRefactored: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const currentHouseholdId = useCurrentHouseholdId();
  const { width: windowWidth } = useWindowDimensions();
  const dayColumnWidth = (windowWidth - 40) / 7;

  // ---------- ViewModel ----------
  const { state, actions, derived } = useCalendarViewModel(
    user?.id ?? '',
    currentHouseholdId ?? undefined,
  );

  // ---------- derived dates ----------
  const weekDates = useMemo(() => {
    const start = startOfWeek(state.currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [state.currentDate]);

  const monthDates = useMemo(() => {
    const start = startOfMonth(state.currentDate);
    const startDate = startOfWeek(start, { weekStartsOn: 1 });
    const endDate = addDays(startDate, 41);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [state.currentDate]);

  const displayDates = state.viewMode === 'month' ? monthDates : weekDates;

  // ---------- handlers ----------
  const handleDayPress = useCallback(
    (date: Date) => {
      actions.selectDate(date);
      navigation.navigate('DayDetail', {
        date: date.toISOString(),
      });
    },
    [actions, navigation],
  );

  const navigateWeek = useCallback(
    (direction: 'prev' | 'next') => {
      const days = state.viewMode === 'month'
        ? (direction === 'next' ? 30 : -30)
        : (direction === 'next' ? 7 : -7);
      actions.navigateDate(days);
    },
    [state.viewMode, actions],
  );

  // ---------- render ----------
  if (state.loading && state.shifts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366F1" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.navButton}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {format(state.currentDate, state.viewMode === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy')}
        </Text>
        <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.navButton}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* View mode toggle */}
      <View style={styles.toggleRow}>
        {(['week', 'month'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.toggleButton, state.viewMode === mode && styles.toggleActive]}
            onPress={() => actions.setViewMode(mode)}
          >
            <Text style={[styles.toggleText, state.viewMode === mode && styles.toggleActiveText]}>
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day headers */}
      <View style={styles.dayHeaders}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <Text key={d} style={[styles.dayHeader, { width: dayColumnWidth }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar grid — placeholder, wire up in full migration */}
      <View style={styles.grid}>
        {displayDates.map((date) => {
          const dayShifts = derived.getShiftsForDate(date);
          const isSelected = isSameDay(date, state.selectedDate);
          const today = isToday(date);

          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[
                styles.dayCell,
                { width: dayColumnWidth },
                today && styles.todayCell,
                isSelected && styles.selectedCell,
              ]}
              onPress={() => handleDayPress(date)}
            >
              <Text style={[styles.dayNumber, today && styles.todayText]}>
                {format(date, 'd')}
              </Text>
              {dayShifts.length > 0 && (
                <View style={styles.shiftDots}>
                  {dayShifts.slice(0, 3).map((s, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: getShiftColor(s, user?.id ?? '') }]}
                    />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <CalendarLegend />

      {/* Error banner */}
      {state.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 28, color: '#FFFFFF' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  toggleButton: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1E293B' },
  toggleActive: { backgroundColor: '#6366F1' },
  toggleText: { color: '#94A3B8', fontSize: 13 },
  toggleActiveText: { color: '#FFFFFF', fontWeight: '600' },
  dayHeaders: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 20 },
  dayHeader: { textAlign: 'center', color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20 },
  dayCell: { alignItems: 'center', paddingVertical: 8, minHeight: 48 },
  todayCell: { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderRadius: 8 },
  selectedCell: { borderWidth: 1, borderColor: '#6366F1', borderRadius: 8 },
  dayNumber: { color: '#E2E8F0', fontSize: 14 },
  todayText: { color: '#6366F1', fontWeight: '700' },
  shiftDots: { flexDirection: 'row', marginTop: 4, gap: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  errorBanner: { backgroundColor: '#EF4444', padding: 8, margin: 16, borderRadius: 8 },
  errorText: { color: '#FFFFFF', fontSize: 13, textAlign: 'center' },
});
