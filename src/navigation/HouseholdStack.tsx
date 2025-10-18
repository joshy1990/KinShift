import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {HouseholdStackParamList} from '@/types';

// Import full-featured screens with Firebase integration
import {HouseholdListScreen} from '@/screens/household/HouseholdListScreen';
import {HouseholdDetailScreen} from '@/screens/household/HouseholdDetailScreen';
import {CreateHouseholdScreen} from '@/screens/household/CreateHouseholdScreen';
import {JoinHouseholdScreen} from '@/screens/household/JoinHouseholdScreen';
import {InviteMembersScreen} from '@/screens/household/InviteMembersScreen';
import {ManageMembersScreen} from '@/screens/household/ManageMembersScreen';
import {InvitationAcceptScreen} from '@/screens/household/InvitationAcceptScreen';
import {RoleManagementScreen} from '@/screens/household/RoleManagementScreen';

const Stack = createNativeStackNavigator<HouseholdStackParamList>();

export const HouseholdStack: React.FC = () => {
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
        name="HouseholdList"
        component={HouseholdListScreen}
        options={{title: 'My Households'}}
      />
      <Stack.Screen
        name="HouseholdDetail"
        component={HouseholdDetailScreen}
        options={{title: 'Household'}}
      />
      <Stack.Screen
        name="CreateHousehold"
        component={CreateHouseholdScreen}
        options={{title: 'Create Household', presentation: 'modal'}}
      />
      <Stack.Screen
        name="JoinHousehold"
        component={JoinHouseholdScreen}
        options={{title: 'Join Household', presentation: 'modal'}}
      />
      <Stack.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{title: 'Invite Members'}}
      />
      <Stack.Screen
        name="ManageMembers"
        component={ManageMembersScreen}
        options={{title: 'Manage Members'}}
      />
      <Stack.Screen
        name="InvitationAccept"
        component={InvitationAcceptScreen}
        options={{title: 'Accept Invitation', presentation: 'modal'}}
      />
      <Stack.Screen
        name="RoleManagement"
        component={RoleManagementScreen}
        options={{title: 'Manage Roles'}}
      />
    </Stack.Navigator>
  );
};
