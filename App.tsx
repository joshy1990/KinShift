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
import * as Sentry from '@sentry/react-native';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('App Error:', error, errorInfo);
    
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
          <Text style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>Something went wrong</Text>
          <Text style={{ color: '#999', fontSize: 14 }}>{this.state.error?.message || 'Unknown error'}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default Sentry.wrap(function App() {
  // Initialize Sentry on app startup
  useEffect(() => {
    initializeSentry();
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
});