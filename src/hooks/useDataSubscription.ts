import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceError } from '@/services/base.service';

/**
 * Generic hook for real-time Firestore data subscriptions.
 * Provides loading, error, and refresh states with automatic cleanup.
 *
 * @template T The type of data being subscribed to
 */
export interface UseDataSubscriptionOptions<T> {
  /** Function that sets up the Firestore onSnapshot listener. Should return an unsubscribe function. */
  subscribe: (onData: (data: T) => void, onError: (error: Error) => void) => () => void;
  /** Optional initial data to use before the subscription fires */
  initialData?: T;
  /** Whether the subscription should be active (default: true) */
  enabled?: boolean;
}

export interface UseDataSubscriptionResult<T> {
  data: T | undefined;
  loading: boolean;
  error: ServiceError | null;
  refresh: () => void;
}

export function useDataSubscription<T>(
  options: UseDataSubscriptionOptions<T>
): UseDataSubscriptionResult<T> {
  const { subscribe, initialData, enabled = true } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = subscribe(
      (newData) => {
        setData(newData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError({
          code: 'subscription-error',
          message: err.message,
        } as ServiceError);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [subscribe, enabled, refreshKey]);

  return { data, loading, error, refresh };
}
