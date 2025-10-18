import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '@/contexts/AuthContext';
import {RootStackParamList} from '@/types';
import {ErrorBoundary} from '@/components/ErrorBoundary';

// Import screens (we'll create these next)
import {OnboardingScreen} from '@/screens/auth/OnboardingScreen';
import {LoginScreen} from '@/screens/auth/LoginScreen';
import {SignupScreen} from '@/screens/auth/SignupScreen';
import {PrivacyPolicyScreen} from '@/screens/profile/PrivacyPolicyScreen';
import {TermsOfServiceScreen} from '@/screens/profile/TermsOfServiceScreen';
import {MainTabNavigator} from './MainTabNavigator';
import {ActivityIndicator, View, StyleSheet} from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
