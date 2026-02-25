/**
 * Unit tests for ErrorBoundary component
 *
 * Tests:
 *  1. Renders children when no error
 *  2. Shows fallback UI when child throws
 *  3. Shows custom fallback if provided
 *  4. Reset button restores children
 *  5. Reports errors to Sentry
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';

// Mock Sentry
const mockCaptureException = jest.fn();
jest.mock('@/config/sentry.config', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

import { ErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws on command
const BrokenChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>Child Content</Text>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for expected errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
  });

  it('renders children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>Hello World</Text>
      </ErrorBoundary>,
    );
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('shows default error UI when child throws', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('shows custom fallback when provided', () => {
    const customFallback = <Text>Custom Error Page</Text>;
    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(getByText('Custom Error Page')).toBeTruthy();
  });

  it('reports error to Sentry', () => {
    render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(mockCaptureException.mock.calls[0][0].message).toBe('Test error');
  });

  it('resets error state when Try Again is pressed', () => {
    let shouldThrow = true;

    const ToggleChild = () => {
      if (shouldThrow) throw new Error('boom');
      return <Text>Recovered</Text>;
    };

    const { getByText, rerender } = render(
      <ErrorBoundary>
        <ToggleChild />
      </ErrorBoundary>,
    );

    expect(getByText('Something went wrong')).toBeTruthy();

    // Fix the error condition before pressing reset
    shouldThrow = false;
    fireEvent.press(getByText('Try Again'));

    // After reset, the boundary re-renders children
    // But we need to re-render to pick up the new value
    rerender(
      <ErrorBoundary>
        <ToggleChild />
      </ErrorBoundary>,
    );
    expect(getByText('Recovered')).toBeTruthy();
  });

  it('does not crash if Sentry fails', () => {
    mockCaptureException.mockImplementationOnce(() => {
      throw new Error('Sentry down');
    });

    const { getByText } = render(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    );
    // Should still show fallback UI
    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
