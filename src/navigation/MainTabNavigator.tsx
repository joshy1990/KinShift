import React, {useState, useEffect} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {MainTabsParamList} from '@/types';
import Icon from 'react-native-vector-icons/Ionicons';
import {useAuth} from '@/contexts/AuthContext';
import {notificationService} from '@/services/notification.service';

// Import screen stacks (we'll create these)
import {CalendarStack} from './CalendarStack';
import {HouseholdStack} from './HouseholdStack';
import {ProfileStack} from './ProfileStack';
import {NotificationsScreen} from '@/screens/notifications/NotificationsScreen';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export const MainTabNavigator: React.FC = () => {
  const {user} = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    // Set up real-time listener for unread notifications
    // Skip for web platform since React Native Firebase doesn't work on web
    if (Platform.OS === 'web') {
      console.log('Notification service disabled on web platform');
      setUnreadCount(0);
      return;
    }

    try {
      const unsubscribe = notificationService.listenToUserNotifications(
        user.id,
        (notifications) => {
          const unread = notifications.filter(n => !n.read).length;
          setUnreadCount(unread);
        }
      );

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (error) {
      console.warn('Failed to setup notification listener:', error);
      setUnreadCount(0);
    }
  }, [user?.id]);

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string;

          switch (route.name) {
            case 'Calendar':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Household':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Notifications':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#0F0F23',
          borderTopColor: 'rgba(255, 255, 255, 0.1)',
          paddingBottom: Math.max(6, insets.bottom),
          paddingTop: 6,
          height: Math.max(60, 54 + insets.bottom),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}>
      <Tab.Screen name="Calendar" component={CalendarStack} />
      <Tab.Screen name="Household" component={HouseholdStack} />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#DC2626',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '600',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
          },
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};
