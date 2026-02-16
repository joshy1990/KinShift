/**
 * useDataSubscription - Generic hook for managing real-time data subscriptions
 * Provides consistent pattern for subscribing/unsubscribing to data sources
 */

import { useState, useEffect, useCallback } from 'react';
import { ServiceError } from '@/services/base.service';

export interface UseDataSubscriptionOptions<T> {
  subscribe: (onData: (data: T) => void, onError: (error: any) => void) => (() => void) | undefined;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: ServiceError) => void;
}

export interface UseDataSubscriptionResult<T> {
  data: T | null;
  loading: boolean;
  error: ServiceError | null;
  refresh: () => void;
}

export function useDataSubscription<T>(
  options: UseDataSubscriptionOptions<T>
): UseDataSubscriptionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);
  const { subscribe, enabled = true, onSuccess, onError } = options;

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribe(
        (newData: T) => {
          setData(newData);
          setLoading(false);
          setError(null);
          onSuccess?.(newData);
        },
        (err: any) => {
          const serviceError: ServiceError = {
            code: err.code || 'unknown',
            message: err.message || 'An error occurred',
            details: err,
          };
          setError(serviceError);
          setLoading(false);
          onError?.(serviceError);
        }
      );
    } catch (err: any) {
      const serviceError: ServiceError = {
        code: err.code || 'subscription-error',
        message: err.message || 'Failed to subscribe to data',
        details: err,
      };
      setError(serviceError);
      setLoading(false);
      onError?.(serviceError);
    }

    return () => {
      unsubscribe?.();
    };
  }, [subscribe, enabled, onSuccess, onError]);

  return { data, loading, error, refresh };
}
