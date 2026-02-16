/**
 * CalendarViewModel - Manages business logic for calendar views
 * Separates presentation logic from UI components
 */

import { useCallback, useMemo } from 'react';
import { 
  startOfWeek, 
  addDays, 
  isSameDay, 
  startOfMonth, 
  eachDayOfInterval 
} from 'date-fns';
import { Shift } from '@/types';
import { shiftService } from '@/services/shift.service';
import { householdService } from '@/services/household.service';
import { ServiceError } from '@/services/base.service';
import { analyzeMultiPersonShifts } from '@/utils/shiftColors';
import { useViewModelState } from '../base/BaseViewModel';

export type ViewMode = 'week' | 'month';

export interface CalendarState {
  currentDate: Date;
  selectedDate: Date;
  shifts: Shift[];
  viewMode: ViewMode;
  users: Record<string, { name: string; email: string }>;
  noteCounts: Record<string, number>;
  loading: boolean;
  error: ServiceError | null;
}

export interface DateColorIndicators {
  colors: string[];
  count: number;
  displayStrategy?: 'single' | 'split' | 'multi';
}

/**
 * Hook that provides calendar business logic
 */
export function useCalendarViewModel(
  userId: string | undefined,
  _householdId: string | null
) {
  const [state, setState] = useViewModelState<CalendarState>({
    currentDate: new Date(),
    selectedDate: new Date(),
    shifts: [],
    viewMode: 'week',
    users: {},
    noteCounts: {},
    loading: true,
    error: null,
  });

  // Computed: Week dates
  const weekDates = useMemo(() => {
    const start = startOfWeek(state.currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [state.currentDate]);

  // Computed: Month dates
  const monthDates = useMemo(() => {
    const start = startOfMonth(state.currentDate);
    const startDate = startOfWeek(start, { weekStartsOn: 1 });
    const endDate = addDays(startDate, 41); // 6 weeks = 42 days
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [state.currentDate]);

  // Computed: Display dates based on view mode
  const displayDates = useMemo(
    () => (state.viewMode === 'month' ? monthDates : weekDates),
    [state.viewMode, monthDates, weekDates]
  );

  /**
   * Navigate to previous/next week or month
   */
  const navigateWeek = useCallback(
    (direction: 'prev' | 'next') => {
      setState(prev => {
        const newDate = new Date(prev.currentDate);
        if (prev.viewMode === 'month') {
          newDate.setMonth(prev.currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else {
          return {
            ...prev,
            currentDate: addDays(prev.currentDate, direction === 'next' ? 7 : -7),
          };
        }
        return { ...prev, currentDate: newDate };
      });
    },
    [setState]
  );

  /**
   * Toggle between week and month view
   */
  const toggleViewMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      viewMode: prev.viewMode === 'week' ? 'month' : 'week',
    }));
  }, [setState]);

  /**
   * Set selected date
   */
  const selectDate = useCallback(
    (date: Date) => {
      setState(prev => ({ ...prev, selectedDate: date }));
    },
    [setState]
  );

  /**
   * Get shifts for a specific date
   */
  const getShiftsForDate = useCallback(
    (date: Date): Shift[] => {
      return state.shifts.filter(shift => {
        let shiftDate: Date;
        if (shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime) {
          shiftDate = new Date((shift.startTime as any).seconds * 1000);
        } else {
          shiftDate = new Date(shift.startTime);
        }
        return isSameDay(shiftDate, date);
      });
    },
    [state.shifts]
  );

  /**
   * Get users working on a specific date
   */
  const getUsersWorkingOnDate = useCallback(
    (date: Date): string[] => {
      const dayShifts = getShiftsForDate(date);
      const uniqueUsers = new Set(dayShifts.map(s => s.ownerId));
      return Array.from(uniqueUsers);
    },
    [getShiftsForDate]
  );

  /**
   * Get color indicators for a date
   */
  const getDateColorIndicators = useCallback(
    (date: Date): DateColorIndicators => {
      if (!userId) return { colors: [], count: 0 };

      const dayShifts = getShiftsForDate(date);

      if (dayShifts.length === 0) {
        return { colors: [], count: 0 };
      }

      const shiftInfo = analyzeMultiPersonShifts(dayShifts, userId);

      return {
        colors: shiftInfo.colors,
        count: shiftInfo.workingCount,
        displayStrategy: shiftInfo.displayStrategy,
      };
    },
    [getShiftsForDate, userId]
  );

  /**
   * Initialize data subscriptions
   */
  const initialize = useCallback(
    (currentUserId: string | undefined, currentHouseholdId: string | null) => {
      let unsubscribeShifts: (() => void) | undefined;
      let unsubscribeNotes: (() => void) | undefined;

      if (!currentHouseholdId) {
        // Personal mode
        if (currentUserId) {
          setState(prev => ({
            ...prev,
            users: {
              [currentUserId]: { 
                name: prev.users[currentUserId]?.name || 'You', 
                email: prev.users[currentUserId]?.email || '' 
              },
            },
          }));

          unsubscribeShifts = shiftService.subscribeToShifts(
            { ownerId: currentUserId },
            (updatedShifts: Shift[]) => {
              const shiftsWithTypes = updatedShifts.map(shift => ({
                ...shift,
                shiftType: shift.shiftType || 'custom',
              }));
              setState(prev => ({ ...prev, shifts: shiftsWithTypes, loading: false }));
            },
            (error) => {
              console.error('Failed to load shifts:', error);
              setState(prev => ({ ...prev, loading: false }));
            }
          );
        }
      } else {
        // Household mode
        unsubscribeShifts = shiftService.subscribeToShifts(
          { householdId: currentHouseholdId },
          (updatedShifts: Shift[]) => {
            const shiftsWithTypes = updatedShifts.map(shift => ({
              ...shift,
              shiftType: shift.shiftType || 'custom',
            }));
            setState(prev => ({ ...prev, shifts: shiftsWithTypes, loading: false }));
          },
          (error) => {
            console.error('Failed to load shifts:', error);
            setState(prev => ({ ...prev, loading: false }));
          }
        );

        // Load household members
        householdService
          .getHouseholdMembers(currentHouseholdId)
          .then(members => {
            const usersMap: Record<string, { name: string; email: string }> = {};
            members.forEach(member => {
              usersMap[member.userId] = {
                name: member.name,
                email: member.email || '',
              };
            });
            setState(prev => ({ ...prev, users: usersMap }));
          })
          .catch(error => {
            console.error('Failed to load household members:', error);
          });

        // Subscribe to day notes for all dates
        // Note: subscribeToDateNotes requires a specific date, so we'll load notes differently
        // For now, skip real-time note count subscription as it requires date-specific queries
      }

      return () => {
        unsubscribeShifts?.();
        unsubscribeNotes?.();
      };
    },
    [setState]
  );

  return {
    // State
    state,
    
    // Computed values
    displayDates,
    weekDates,
    monthDates,
    
    // Actions
    navigateWeek,
    toggleViewMode,
    selectDate,
    initialize,
    
    // Queries
    getShiftsForDate,
    getUsersWorkingOnDate,
    getDateColorIndicators,
  };
}
