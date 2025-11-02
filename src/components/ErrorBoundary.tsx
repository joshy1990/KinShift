/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 * Reports errors to Sentry for monitoring
 */

import React, {Component, ReactNode, ErrorInfo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {captureException} from '@/config/sentry.config';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return {hasError: true};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('Error Boundary caught error:', error, errorInfo);

    // Report to Sentry for production monitoring
    try {
      captureException(error, {
        errorInfo,
        componentStack: errorInfo.componentStack,
        component: 'ErrorBoundary',
      });
    } catch (sentryError) {
      console.error('Failed to report error to Sentry:', sentryError);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We encountered an unexpected error. Please try again.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details:</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorStack}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  errorDetails: {
    width: '100%',
    backgroundColor: '#1F1F3A',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    maxHeight: 300,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#F87171',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 200,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
