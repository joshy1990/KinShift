import { useRef, useCallback } from 'react';

/**
 * Hook for detecting double-tap gestures.
 * Useful for actions like quick-editing a shift by double-tapping a calendar day.
 *
 * @param onDoubleTap Callback fired when a double-tap is detected
 * @param delay Maximum interval (ms) between taps to count as a double-tap (default: 300)
 */
export function useDoubleTap(
  onDoubleTap: () => void,
  delay: number = 300
): () => void {
  const lastTapRef = useRef<number>(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < delay) {
      onDoubleTap();
      lastTapRef.current = 0; // Reset to avoid triple-tap triggering again
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap, delay]);

  return handleTap;
}
