import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {CalendarStackParamList} from '@/types';

// Import full-featured screens with Firebase integration
import {CalendarViewScreen} from '@/screens/calendar/CalendarViewScreen';
import {ShiftDetailScreen} from '@/screens/calendar/ShiftDetailScreen';
import {AddShiftScreen} from '@/screens/calendar/AddShiftScreen';
import {AddShiftPatternScreen} from '@/screens/calendar/AddShiftPatternScreen';
import {EditShiftScreen} from '@/screens/calendar/EditShiftScreen';
import {DayDetailScreen} from '@/screens/calendar/DayDetailScreen';
import {TwoWeekViewScreen} from '@/screens/calendar/TwoWeekViewScreen';
import {PatternBuilderScreen} from '@/screens/calendar/PatternBuilderScreen';
import {CalendarExportScreen} from '@/screens/calendar/CalendarExportScreen';

const Stack = createNativeStackNavigator<CalendarStackParamList>();

export const CalendarStack: React.FC = () => {
  return (
    <Stack.Navigator
      id={undefined}
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
        name="CalendarView"
        component={CalendarViewScreen}
        options={{title: 'Calendar'}}
      />
      <Stack.Screen
        name="ShiftDetail"
        component={ShiftDetailScreen}
        options={{title: 'Shift Details'}}
      />
      <Stack.Screen
        name="DayDetail"
        component={DayDetailScreen}
        options={{title: 'Day Details'}}
      />
      <Stack.Screen
        name="TwoWeekView"
        component={TwoWeekViewScreen}
        options={{title: 'Two Week View'}}
      />
      <Stack.Screen
        name="AddShift"
        component={AddShiftScreen}
        options={{title: 'Add Shift', presentation: 'modal'}}
      />
      <Stack.Screen
        name="AddShiftPattern"
        component={AddShiftPatternScreen}
        options={{title: 'Add Pattern', presentation: 'modal'}}
      />
      <Stack.Screen
        name="EditShift"
        component={EditShiftScreen}
        options={{title: 'Edit Shift', presentation: 'modal'}}
      />
      <Stack.Screen
        name="PatternBuilder"
        component={PatternBuilderScreen}
        options={{title: 'Create Custom Pattern', presentation: 'modal'}}
      />
      <Stack.Screen
        name="CalendarExport"
        component={CalendarExportScreen}
        options={{title: 'Export Calendar'}}
      />
    </Stack.Navigator>
  );
};
