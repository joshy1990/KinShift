/**
 * Sentry Configuration
 * Error tracking and performance monitoring
 * 
 * Setup Instructions:
 * 1. Create account at https://sentry.io
 * 2. Create new React Native project
 * 3. Copy DSN to .env.local
 * 4. Configure source maps for release builds
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Sentry DSN from expo-constants (configured in app.config.js)
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn || '';

// Only initialize if DSN is provided
const SENTRY_ENABLED = SENTRY_DSN && SENTRY_DSN.startsWith('https://');

/**
 * Initialize Sentry
 */
export const initializeSentry = (): void => {
  if (!SENTRY_ENABLED) {
    console.log('[Sentry] Disabled - No DSN configured');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      
      // Environment
      environment: __DEV__ ? 'development' : 'production',
      
      // Enable debug mode in development
      debug: __DEV__,
      
      // Performance monitoring - sample 100% in dev, 10% in production
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      
      // Enable automatic session tracking
      enableAutoSessionTracking: true,
      
      // Session tracking interval
      sessionTrackingIntervalMillis: 30000, // 30 seconds
      
      // Enable native crash handling
      enableNative: true,
      enableNativeCrashHandling: true,
      
      // Attach stack traces to messages
      attachStacktrace: true,
      
      // Maximum breadcrumbs to keep
      maxBreadcrumbs: 100,
      
      // Release version (will be set via build)
      // release: 'kinshift@1.0.0',
      // dist: '1',
      
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Don't send events in development (unless you want to test)
        if (__DEV__ && !Constants.expoConfig?.extra?.sentryDebug) {
          console.log('[Sentry] Event blocked in development:', event);
          return null;
        }
        
        // Filter out network errors (handled separately)
        const exception = hint.originalException;
        if (exception && typeof exception === 'object' && 'message' in exception) {
          const message = (exception as any).message?.toLowerCase() || '';
          if (message.includes('network') || message.includes('timeout')) {
            // Log but don't send to Sentry (too noisy)
            return null;
          }
        }
        
        return event;
      },
      
      // Add context to errors
      beforeBreadcrumb(breadcrumb) {
        // Filter out sensitive breadcrumbs
        if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
          return null; // Don't send console.log breadcrumbs
        }
        return breadcrumb;
      },
      
      // Integration configurations
      integrations: [
        // React Navigation integration is handled automatically by newer versions
      ],
    });

    console.log('[Sentry] Initialized successfully');
  } catch (error) {
    console.error('[Sentry] Initialization failed:', error);
  }
};

/**
 * Set user context for error tracking
 */
export const setSentryUser = (userId: string, email?: string, name?: string): void => {
  if (!SENTRY_ENABLED) return;
  
  Sentry.setUser({
    id: userId,
    email,
    username: name,
  });
};

/**
 * Clear user context (on logout)
 */
export const clearSentryUser = (): void => {
  if (!SENTRY_ENABLED) return;
  Sentry.setUser(null);
};

/**
 * Add breadcrumb for tracking user actions
 */
export const addSentryBreadcrumb = (
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  data?: Record<string, any>
): void => {
  if (!SENTRY_ENABLED) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};

/**
 * Capture exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>): void => {
  if (!SENTRY_ENABLED) {
    console.error('[Sentry Disabled] Exception:', error, context);
    return;
  }
  
  if (context) {
    Sentry.setContext('additional_context', context);
  }
  
  Sentry.captureException(error);
};

/**
 * Capture message manually
 */
export const captureMessage = (
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
): void => {
  if (!SENTRY_ENABLED) {
    console.log('[Sentry Disabled] Message:', message, context);
    return;
  }
  
  if (context) {
    Sentry.setContext('additional_context', context);
  }
  
  Sentry.captureMessage(message, level);
};

/**
 * Set custom tag for filtering
 */
export const setSentryTag = (key: string, value: string): void => {
  if (!SENTRY_ENABLED) return;
  Sentry.setTag(key, value);
};

/**
 * Set custom context
 */
export const setSentryContext = (name: string, context: Record<string, any>): void => {
  if (!SENTRY_ENABLED) return;
  Sentry.setContext(name, context);
};

export { Sentry };
export const isSentryEnabled = SENTRY_ENABLED;
