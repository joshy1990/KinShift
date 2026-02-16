/**
 * Base ViewModel class providing common patterns for all ViewModels
 * Implements observable state management and lifecycle methods
 */

import { useState, useEffect, useCallback } from 'react';

export interface ViewModelState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refreshing: boolean;
}

export abstract class BaseViewModel<TState = any> {
  protected abstract getInitialState(): TState;
  
  /**
   * Initialize the ViewModel - called when component mounts
   */
  abstract initialize(...args: any[]): Promise<void> | void;
  
  /**
   * Cleanup the ViewModel - called when component unmounts
   */
  cleanup(): void {
    // Override in subclasses if needed
  }
}

/**
 * Hook to create and manage a ViewModel instance
 */
export function useViewModel<T extends BaseViewModel>(
  ViewModelClass: new (...args: any[]) => T,
  ...args: any[]
): T {
  const [viewModel] = useState(() => new ViewModelClass(...args));
  
  useEffect(() => {
    viewModel.initialize(...args);
    
    return () => {
      viewModel.cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewModel]);
  
  return viewModel;
}

/**
 * Custom hook for managing ViewModel state in React components
 */
export function useViewModelState<T>(
  initialState: T
): [T, (updates: Partial<T> | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialState);
  
  const updateState = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    if (typeof updates === 'function') {
      setState(updates);
    } else {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);
  
  return [state, updateState];
}
