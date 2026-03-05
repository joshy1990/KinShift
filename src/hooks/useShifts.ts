import { useState, useEffect, useCallback, useRef } from 'react';
import { Shift, ShiftMessage } from '@/types';
import { shiftService, ShiftFilters, CreateShiftData, UpdateShiftData } from '@/services/shift.service';
import { ServiceError } from '@/services/base.service';
import { useAuth } from '@/contexts/AuthContext';

export interface UseShiftsOptions {
  householdId: string;
  startDate?: Date;
  endDate?: Date;
  realtime?: boolean;
  autoRefresh?: boolean;
}

export interface UseShiftsResult {
  shifts: Shift[];
  loading: boolean;
  error: ServiceError | null;
  refreshing: boolean;
  hasMore: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  createShift: (shiftData: Omit<CreateShiftData, 'ownerId'>) => Promise<Shift>;
  updateShift: (shiftId: string, updates: UpdateShiftData) => Promise<void>;
  deleteShift: (shiftId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  
  // Utility functions
  getShiftsForDate: (date: Date) => Shift[];
  getShiftById: (shiftId: string) => Shift | undefined;
}

export const useShifts = (options: UseShiftsOptions): UseShiftsResult => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [hasMore, setHasMore] = useState(false);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const cursorRef = useRef<any>(null);

  // Clear error when options change
  useEffect(() => {
    setError(null);
  }, [options.householdId, options.startDate, options.endDate]);

  // Load shifts
  const loadShifts = useCallback(async (loadMore = false) => {
    try {
      if (!loadMore) {
        setLoading(true);
        cursorRef.current = null;
      } else {
        setRefreshing(true);
      }

      const filters: ShiftFilters = {
        householdId: options.householdId,
        startDate: options.startDate,
        endDate: options.endDate,
      };

      const result = await shiftService.getShifts(filters, {
        cursor: loadMore ? cursorRef.current : undefined,
      });

      if (loadMore) {
        setShifts(prev => [...prev, ...result.shifts]);
      } else {
        setShifts(result.shifts);
      }

      setHasMore(result.hasMore);
      cursorRef.current = result.cursor;
      setError(null);
    } catch (err) {
      setError(err as ServiceError);
      console.error('Error loading shifts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [options.householdId, options.startDate, options.endDate]);

  // Setup realtime subscription
  useEffect(() => {
    if (!options.realtime || !options.householdId) return;

    const filters: ShiftFilters = {
      householdId: options.householdId,
      startDate: options.startDate,
      endDate: options.endDate,
    };

    unsubscribeRef.current = shiftService.subscribeToShifts(
      filters,
      (newShifts) => {
        setShifts(newShifts);
        setLoading(false);
        setError(null);
      },
      (error) => {
        setError(error);
        setLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [options.realtime, options.householdId, options.startDate, options.endDate]);

  // Initial load for non-realtime mode
  useEffect(() => {
    if (!options.realtime && options.householdId) {
      loadShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadShifts, options.realtime]);

  // Auto refresh
  useEffect(() => {
    if (!options.autoRefresh || options.realtime) return;

    const interval = setInterval(() => {
      loadShifts();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadShifts, options.autoRefresh, options.realtime]);

  // Actions
  const refresh = useCallback(async () => {
    await loadShifts(false);
  }, [loadShifts]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loading && !refreshing) {
      await loadShifts(true);
    }
  }, [loadShifts, hasMore, loading, refreshing]);

  const createShift = useCallback(async (shiftData: Omit<CreateShiftData, 'ownerId'>): Promise<Shift> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const newShift = await shiftService.createShift({
        ...shiftData,
        ownerId: user.id,
      });

      // Update local state if not using realtime
      if (!options.realtime) {
        setShifts(prev => [newShift, ...prev]);
      }

      return newShift;
    } catch (err) {
      const error = err as ServiceError;
      setError(error);
      throw error;
    }
  }, [user, options.realtime]);

  const updateShift = useCallback(async (shiftId: string, updates: UpdateShiftData) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      await shiftService.updateShift(shiftId, updates, user.id);

      // Update local state if not using realtime
      if (!options.realtime) {
        setShifts(prev => prev.map(shift => 
          shift.id === shiftId 
            ? { ...shift, ...updates, updatedAt: new Date(), lastEditedBy: user.id }
            : shift
        ));
      }
    } catch (err) {
      const error = err as ServiceError;
      setError(error);
      throw error;
    }
  }, [user, options.realtime]);

  const deleteShift = useCallback(async (shiftId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      await shiftService.deleteShift(shiftId, user.id);

      // Update local state if not using realtime
      if (!options.realtime) {
        setShifts(prev => prev.filter(shift => shift.id !== shiftId));
      }
    } catch (err) {
      const error = err as ServiceError;
      setError(error);
      throw error;
    }
  }, [user, options.realtime]);

  // Utility functions
  const getShiftsForDate = useCallback((date: Date): Shift[] => {
    const dateStr = date.toISOString().split('T')[0];
    return shifts.filter(shift => {
      const st = (shift.startTime as any)?.toDate ? (shift.startTime as any).toDate() : new Date(shift.startTime);
      const shiftDate = st.toISOString().split('T')[0];
      return shiftDate === dateStr;
    });
  }, [shifts]);

  const getShiftById = useCallback((shiftId: string): Shift | undefined => {
    return shifts.find(shift => shift.id === shiftId);
  }, [shifts]);

  return {
    shifts,
    loading,
    error,
    refreshing,
    hasMore,
    refresh,
    createShift,
    updateShift,
    deleteShift,
    loadMore,
    getShiftsForDate,
    getShiftById,
  };
};

export interface UseShiftMessagesOptions {
  shiftId: string;
  realtime?: boolean;
}

export interface UseShiftMessagesResult {
  messages: ShiftMessage[];
  loading: boolean;
  error: ServiceError | null;
  
  addMessage: (message: string, isPrivate?: boolean) => Promise<ShiftMessage>;
  refresh: () => Promise<void>;
}

export const useShiftMessages = (options: UseShiftMessagesOptions): UseShiftMessagesResult => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ShiftMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const shiftMessages = await shiftService.getShiftMessages(options.shiftId);
      setMessages(shiftMessages);
      setError(null);
    } catch (err) {
      setError(err as ServiceError);
    } finally {
      setLoading(false);
    }
  }, [options.shiftId]);

  useEffect(() => {
    if (options.shiftId) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMessages]);

  const addMessage = useCallback(async (message: string, isPrivate = false): Promise<ShiftMessage> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const newMessage = await shiftService.addShiftMessage(
        options.shiftId,
        message,
        user.id,
        user.name || user.email,
        isPrivate
      );

      setMessages(prev => [...prev, newMessage]);
      return newMessage;
    } catch (err) {
      const error = err as ServiceError;
      setError(error);
      throw error;
    }
  }, [options.shiftId, user]);

  const refresh = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  return {
    messages,
    loading,
    error,
    addMessage,
    refresh,
  };
};