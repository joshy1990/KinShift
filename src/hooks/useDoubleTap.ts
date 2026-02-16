/**
 * useDoubleTab - Hook for detecting double-tap gestures on dates
 * Extracted UI interaction logic that can be reused across components
 */

import { useState, useCallback } from 'react';
import { isSameDay } from 'date-fns';

export interface UseDoubleTapResult {
  handleTap: (date: Date, onSingleTap: () => void, onDoubleTap: () => void) => void;
  reset: () => void;
}

export function useDoubleTap(threshold = 300): UseDoubleTapResult {
  const [lastTapDate, setLastTapDate] = useState<Date | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  const handleTap = useCallback(
    (date: Date, onSingleTap: () => void, onDoubleTap: () => void) => {
      const now = Date.now();
      const isDoubleTap =
        lastTapDate && isSameDay(lastTapDate, date) && now - lastTapTime < threshold;

      if (isDoubleTap) {
        onDoubleTap();
        setLastTapDate(null);
        setLastTapTime(0);
      } else {
        onSingleTap();
        setLastTapDate(date);
        setLastTapTime(now);
      }
    },
    [lastTapDate, lastTapTime, threshold]
  );

  const reset = useCallback(() => {
    setLastTapDate(null);
    setLastTapTime(0);
  }, []);

  return { handleTap, reset };
}
