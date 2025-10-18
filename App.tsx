import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {StatusBar, Platform, View, Text} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from './src/contexts/AuthContext';
import {HouseholdProvider} from './src/contexts/HouseholdContext';
import {RootNavigator} from './src/navigation/RootNavigator';

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

export default function App(): React.JSX.Element {
  console.log('App starting...');
  
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <HouseholdProvider>
            <NavigationContainer>
              <StatusBar
                barStyle="light-content"
                backgroundColor="#0F0F23"
                translucent={Platform.OS === 'android'}
              />
              <RootNavigator />
            </NavigationContainer>
          </HouseholdProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}