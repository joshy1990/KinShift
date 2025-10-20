/**
 * useRateLimit Hook
 * 
 * Client-side rate limit checking and enforcement
 * Integrates with Cloud Function rate limiter
 * 
 * Usage in components:
 *   const { checkLimit, isLimited, remaining, resetAt } = useRateLimit();
 *   
 *   const handleCreateShift = async () => {
 *     const ok = await checkLimit('shift:create');
 *     if (!ok) return;
 *     // Proceed with shift creation
 *   };
 */

import { useState, useCallback, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as Sentry from '@sentry/react-native';

interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitCache {
  [operation: string]: {
    remaining: number;
    resetAt: number;
    lastCheck: number;
  };
}

/**
 * useRateLimit Hook
 * 
 * Manages rate limit checks with local caching and exponential backoff
 */
export function useRateLimit() {
  const [isLimited, setIsLimited] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<{ [key: string]: number }>({});
  const [resetAt, setResetAt] = useState<{ [key: string]: number }>({});
  
  const cacheRef = useRef<RateLimitCache>({});
  const functions = getFunctions();

  /**
   * Check rate limit for operation
   * 
   * @param operation - Operation identifier (e.g., 'shift:create')
   * @returns true if allowed, false if rate limited
   */
  const checkLimit = useCallback(
    async (operation: string): Promise<boolean> => {
      try {
        // Check local cache first (1-second TTL)
        const cached = cacheRef.current[operation];
        const now = Date.now();
        
        if (cached && now - cached.lastCheck < 1000) {
          if (now < cached.resetAt * 1000) {
            setRemaining(prev => ({ ...prev, [operation]: cached.remaining }));
            setResetAt(prev => ({ ...prev, [operation]: cached.resetAt }));
            return true;
          }
        }

        // Call Cloud Function to check limit
        const enforceRateLimit = httpsCallable(functions, 'enforceRateLimit');
        const response = await enforceRateLimit({ operation });

        const data = response.data as RateLimitStatus;

        // Update cache
        cacheRef.current[operation] = {
          remaining: data.remaining,
          resetAt: data.resetAt,
          lastCheck: now,
        };

        // Update state
        setRemaining(prev => ({ ...prev, [operation]: data.remaining }));
        setResetAt(prev => ({ ...prev, [operation]: data.resetAt }));
        setIsLimited(null);

        return data.allowed;
      } catch (error: any) {
        if (error.code === 'resource-exhausted') {
          const resetTime = error.customData?.resetAt || 0;
          const retryAfter = error.customData?.retryAfter || 60;

          setIsLimited(operation);
          setResetAt(prev => ({ ...prev, [operation]: resetTime }));

          // Log to Sentry
          Sentry.captureMessage('Rate limit exceeded', {
            level: 'warning',
            tags: { operation },
            extra: { retryAfter, resetTime },
          });

          return false;
        }

        // If error is not rate-limit related, log and allow operation
        console.warn('Rate limit check error:', error);
        Sentry.captureException(error);

        return true; // Fail open
      }
    },
    [functions]
  );

  /**
   * Get time remaining until rate limit resets
   * 
   * @param operation - Operation identifier
   * @returns milliseconds until reset, or 0 if no limit
   */
  const getTimeUntilReset = useCallback((operation: string): number => {
    const reset = resetAt[operation];
    if (!reset) return 0;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (reset - now) * 1000);
  }, [resetAt]);

  /**
   * Format time until reset as readable string
   * 
   * @param operation - Operation identifier
   * @returns Formatted string (e.g., "2 minutes", "30 seconds")
   */
  const getResetTimeString = useCallback((operation: string): string => {
    const ms = getTimeUntilReset(operation);
    if (ms === 0) return 'now';

    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds} second${seconds > 1 ? 's' : ''}`;

    const minutes = Math.ceil(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;

    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }, [getTimeUntilReset]);

  /**
   * Clear cache for operation (for testing)
   */
  const clearCache = useCallback((operation?: string): void => {
    if (operation) {
      delete cacheRef.current[operation];
    } else {
      cacheRef.current = {};
    }
  }, []);

  return {
    checkLimit,
    isLimited,
    remaining,
    resetAt,
    getTimeUntilReset,
    getResetTimeString,
    clearCache,
  };
}

/**
 * Wrapper hook for specific operations
 * Provides simpler API for common operations
 */
export function useOperationRateLimit(operation: string) {
  const { checkLimit, isLimited, remaining, resetAt, getResetTimeString } =
    useRateLimit();

  const isCurrentlyLimited = isLimited === operation;
  const currentRemaining = remaining[operation] ?? -1;
  const resetTime = getResetTimeString(operation);

  return {
    checkLimit: () => checkLimit(operation),
    isLimited: isCurrentlyLimited,
    remaining: currentRemaining,
    resetTime,
    canOperate: !isCurrentlyLimited,
  };
}

export default useRateLimit;
