import { useState, useCallback, useRef } from 'react';

/**
 * Base state shape for all ViewModels.
 * Every ViewModel state extends this with its own data fields.
 */
export interface BaseViewModelState {
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

/**
 * Utility hook that provides managed state for ViewModels.
 * Follows the MVVM pattern described in ARCHITECTURE.md.
 *
 * @template T The ViewModel-specific state (must extend BaseViewModelState)
 * @param initialState The starting state values
 */
export function useViewModelState<T extends BaseViewModelState>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const mountedRef = useRef(true);

  /** Safely update state only if the component is still mounted */
  const safeSetState = useCallback((updates: Partial<T>) => {
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  /** Reset state to initial values */
  const resetState = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  /** Helper: wrap an async operation with loading / error handling */
  const withLoading = useCallback(
    async <R>(operation: () => Promise<R>): Promise<R | undefined> => {
      safeSetState({ loading: true, error: null } as Partial<T>);
      try {
        const result = await operation();
        safeSetState({ loading: false } as Partial<T>);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        safeSetState({ loading: false, error: message } as Partial<T>);
        return undefined;
      }
    },
    [safeSetState],
  );

  return { state, setState: safeSetState, resetState, withLoading, mountedRef };
}
