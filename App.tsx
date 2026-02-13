import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {StatusBar, Platform, View, Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import {HouseholdProvider} from './src/contexts/HouseholdContext';
import {SubscriptionProvider} from './src/contexts/SubscriptionContext';
import {RootNavigator} from './src/navigation/RootNavigator';
import {notificationLinkingConfiguration} from './src/utils/notificationHandlers';
import {initializeSentry, captureException} from './src/config/sentry.config';
import {runRetentionCleanupIfDue} from './src/utils/dataRetention';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[ErrorBoundary] App Error:', error);
    console.error('[ErrorBoundary] Error Info:', errorInfo);
    
    // Report to Sentry
    try {
      captureException(error, {
        errorInfo,
        component: 'AppErrorBoundary',
        componentStack: errorInfo.componentStack,
      });
    } catch (sentryError) {
      console.error('Failed to report error to Sentry:', sentryError);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#0F0F23' }}>
          <Text style={{ color: '#fff', fontSize: 18, marginBottom: 10, textAlign: 'center' }}>App Failed to Start</Text>
          <Text style={{ color: '#999', fontSize: 14, textAlign: 'center' }}>{this.state.error?.message || 'Unknown error'}</Text>
          <Text style={{ color: '#666', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            {this.state.error?.stack?.substring(0, 200)}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Initialize Sentry on app startup
  useEffect(() => {
    initializeSentry();
  }, []);

  // Run daily data-retention cleanup (fire-and-forget)
  useEffect(() => {
    runRetentionCleanupIfDue();
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <HouseholdProvider>
              <NavigationContainer linking={notificationLinkingConfiguration}>
                <StatusBar
                  barStyle="light-content"
                  backgroundColor="#0F0F23"
                  translucent={Platform.OS === 'android'}
                />
                <RootNavigator />
              </NavigationContainer>
            </HouseholdProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;