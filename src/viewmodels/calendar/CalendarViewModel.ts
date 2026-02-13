import { useEffect, useCallback, useRef } from 'react';
import { Shift } from '@/types';
import { shiftService, ShiftFilters } from '@/services/shift.service';
import { dayNoteService } from '@/services/dayNote.service';
import { eachDayOfInterval } from 'date-fns';
import { householdService } from '@/services/household.service';
import { useViewModelState, BaseViewModelState } from '@/viewmodels/base/BaseViewModel';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  isSameDay,
} from 'date-fns';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface CalendarState extends BaseViewModelState {
  shifts: Shift[];
  users: Record<string, { name: string; email: string }>;
  noteCounts: Record<string, number>;
  currentDate: Date;
  selectedDate: Date;
  viewMode: 'week' | 'month';
}

const initialState: CalendarState = {
  loading: true,
  error: null,
  refreshing: false,
  shifts: [],
  users: {},
  noteCounts: {},
  currentDate: new Date(),
  selectedDate: new Date(),
  viewMode: 'week',
};

// ---------------------------------------------------------------------------
// ViewModel hook
// ---------------------------------------------------------------------------

export function useCalendarViewModel(userId: string, householdId: string | undefined) {
  const { state, setState, withLoading } = useViewModelState<CalendarState>(initialState);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ---- data fetching -------------------------------------------------------

  const loadShifts = useCallback(async () => {
    if (!userId) return;

    const start = state.viewMode === 'week'
      ? startOfWeek(state.currentDate, { weekStartsOn: 1 })
      : startOfMonth(state.currentDate);
    const end = state.viewMode === 'week'
      ? endOfWeek(state.currentDate, { weekStartsOn: 1 })
      : endOfMonth(state.currentDate);

    await withLoading(async () => {
      const filters: ShiftFilters = {
        householdId: householdId || undefined,
        ownerId: householdId ? undefined : userId,
        startDate: start,
        endDate: end,
      };
      const result = await shiftService.getShifts(filters);
      setState({ shifts: result.shifts });
    });
  }, [userId, householdId, state.currentDate, state.viewMode, setState, withLoading]);

  const loadUsers = useCallback(async () => {
    if (!householdId) return;
    try {
      const members = await householdService.getHouseholdMembers(householdId);
      const userMap: Record<string, { name: string; email: string }> = {};
      members.forEach((m) => {
        userMap[m.userId] = { name: m.name, email: m.email || '' };
      });
      setState({ users: userMap });
    } catch {
      // non-critical — proceed without user names
    }
  }, [householdId, setState]);

  const loadNoteCounts = useCallback(async () => {
    if (!userId) return;
    const targetId = householdId || userId;
    try {
      const monthStart = startOfMonth(state.currentDate);
      const monthEnd = endOfMonth(state.currentDate);
      const dates = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const counts = await dayNoteService.getNoteCounts(
        targetId,
        dates,
      );
      setState({ noteCounts: counts });
    } catch {
      // non-critical
    }
  }, [userId, householdId, state.currentDate, setState]);

  // ---- lifecycle -----------------------------------------------------------

  useEffect(() => {
    loadShifts();
    loadUsers();
    loadNoteCounts();
  }, [loadShifts, loadUsers, loadNoteCounts]);

  // ---- actions -------------------------------------------------------------

  const setViewMode = useCallback(
    (mode: 'week' | 'month') => setState({ viewMode: mode }),
    [setState],
  );

  const navigateDate = useCallback(
    (days: number) => setState({ currentDate: addDays(state.currentDate, days) }),
    [state.currentDate, setState],
  );

  const selectDate = useCallback(
    (date: Date) => setState({ selectedDate: date }),
    [setState],
  );

  const refresh = useCallback(async () => {
    setState({ refreshing: true });
    await loadShifts();
    await loadNoteCounts();
    setState({ refreshing: false });
  }, [loadShifts, loadNoteCounts, setState]);

  // ---- derived data --------------------------------------------------------

  const getShiftsForDate = useCallback(
    (date: Date) => state.shifts.filter((s) => isSameDay(new Date(s.startTime), date)),
    [state.shifts],
  );

  // ---- cleanup -------------------------------------------------------------

  useEffect(() => {
    const currentUnsub = unsubscribeRef.current;
    return () => {
      currentUnsub?.();
    };
  }, []);

  return {
    state,
    actions: {
      loadShifts,
      refresh,
      setViewMode,
      navigateDate,
      selectDate,
    },
    derived: {
      getShiftsForDate,
    },
  };
}
