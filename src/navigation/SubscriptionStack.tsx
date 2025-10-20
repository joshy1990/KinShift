import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {PricingScreen} from '../screens/subscription/PricingScreen';
import {SubscriptionManagementScreen} from '../screens/subscription/SubscriptionManagementScreen';

export type SubscriptionStackParamList = {
  SubscriptionManagement: undefined;
  Pricing: undefined;
};

const Stack = createNativeStackNavigator<SubscriptionStackParamList>();

export const SubscriptionStack: React.FC = () => {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#0F0F23',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Stack.Screen
        name="SubscriptionManagement"
        component={SubscriptionManagementScreen}
        options={{
          title: 'My Subscription',
        }}
      />
      <Stack.Screen
        name="Pricing"
        component={PricingScreen}
        options={{
          title: 'Choose a Plan',
        }}
      />
    </Stack.Navigator>
  );
};
