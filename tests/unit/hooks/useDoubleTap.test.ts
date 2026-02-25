/**
 * Unit tests for useDoubleTap hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { useDoubleTap } from '@/hooks/useDoubleTap';

describe('useDoubleTap', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls onSingleTap on first tap', () => {
    const { result } = renderHook(() => useDoubleTap(300));
    const onSingle = jest.fn();
    const onDouble = jest.fn();

    act(() => {
      result.current.handleTap(new Date('2026-03-15'), onSingle, onDouble);
    });

    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it('calls onDoubleTap on rapid same-day double tap', () => {
    const { result } = renderHook(() => useDoubleTap(300));
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const date = new Date('2026-03-15');

    // First tap
    act(() => {
      result.current.handleTap(date, onSingle, onDouble);
    });

    // Second tap within threshold on same day
    act(() => {
      result.current.handleTap(date, onSingle, onDouble);
    });

    expect(onSingle).toHaveBeenCalledTimes(1);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  it('calls onSingleTap twice for taps on different days', () => {
    const { result } = renderHook(() => useDoubleTap(300));
    const onSingle = jest.fn();
    const onDouble = jest.fn();

    act(() => {
      result.current.handleTap(new Date('2026-03-15'), onSingle, onDouble);
    });

    act(() => {
      result.current.handleTap(new Date('2026-03-16'), onSingle, onDouble);
    });

    expect(onSingle).toHaveBeenCalledTimes(2);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it('reset clears tap state', () => {
    const { result } = renderHook(() => useDoubleTap(300));
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const date = new Date('2026-03-15');

    act(() => {
      result.current.handleTap(date, onSingle, onDouble);
    });

    act(() => {
      result.current.reset();
    });

    // After reset, next tap is a single tap again
    act(() => {
      result.current.handleTap(date, onSingle, onDouble);
    });

    expect(onSingle).toHaveBeenCalledTimes(2);
    expect(onDouble).not.toHaveBeenCalled();
  });

  it('respects custom threshold', () => {
    const { result } = renderHook(() => useDoubleTap(0)); // 0ms threshold
    const onSingle = jest.fn();
    const onDouble = jest.fn();
    const date = new Date('2026-03-15');

    act(() => {
      result.current.handleTap(date, onSingle, onDouble);
    });

    // Even immediate second tap won't register because threshold is 0
    // and Date.now() will have advanced slightly
    act(() => {
      jest.advanceTimersByTime(1);
      result.current.handleTap(date, onSingle, onDouble);
    });

    // With 0ms threshold, second tap comes after the window
    expect(onSingle).toHaveBeenCalledTimes(2);
  });
});
