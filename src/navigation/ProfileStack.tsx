import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ProfileStackParamList} from '@/types';

// Import profile screens
import {ProfileScreen} from '@/screens/profile/ProfileScreen';
import {EditProfileScreen} from '@/screens/profile/EditProfileScreen';
import {ChangePasswordScreen} from '@/screens/profile/ChangePasswordScreen';
import {NotificationPreferencesScreen} from '@/screens/profile/NotificationPreferencesScreen';
import {AboutScreen} from '@/screens/profile/AboutScreen';
import {SubscriptionScreen} from '@/screens/profile/SubscriptionScreen';
import {PlanComparisonScreen} from '@/screens/profile/PlanComparisonScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F0F23',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{title: 'Edit Profile'}}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{title: 'Change Password'}}
      />
      <Stack.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{title: 'Notification Settings'}}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{title: 'About'}}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{title: 'Subscription'}}
      />
      <Stack.Screen
        name="PlanComparison"
        component={PlanComparisonScreen}
        options={{title: 'Choose Your Plan'}}
      />
    </Stack.Navigator>
  );
};
