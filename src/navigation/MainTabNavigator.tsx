import React, {useState, useEffect, useMemo} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Platform, Dimensions, StatusBar, View, Text} from 'react-native';
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
import {AdBanner} from '@/components/AdBanner';

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Responsive navigation sizing
const getNavBarDimensions = (insets: any) => {
  const {width, height} = Dimensions.get('window');
  const isTablet = width >= 768;
  const isMobile = width < 768;
  
  // Safe area bottom (handles iPhone notch, Android buttons, etc.)
  const safeAreaBottom = Math.max(0, insets.bottom);
  
  // Base nav bar height - needs room for icon + label + padding
  // Mobile: 90px (icon 24 + label 10 + padding 10 + safe area)
  // Tablet: 100px (more generous spacing)
  // Desktop: 110px (even more breathing room)
  const baseTabHeight = isMobile ? 90 : isTablet ? 100 : 110;
  
  // Ad banner heights (responsive)
  const adBannerHeight = isMobile ? 50 : isTablet ? 60 : 70;
  
  return {
    tabBarHeight: baseTabHeight + safeAreaBottom,
    tabBarPaddingBottom: safeAreaBottom + 8,
    tabBarPaddingTop: 8,
    adBannerHeight,
    totalBottomSpace: baseTabHeight + safeAreaBottom + adBannerHeight,
  };
};

export const MainTabNavigator: React.FC = () => {
  const {user} = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const insets = useSafeAreaInsets();
  const navDimensions = useMemo(() => getNavBarDimensions(insets), [insets]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    // Set up real-time listener for unread notifications
    // Skip for web platform since React Native Firebase doesn't work on web
    if (Platform.OS === 'web') {
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
    <View style={{flex: 1, backgroundColor: '#000', flexDirection: 'column'}}>
      {/* Main Navigator - takes remaining space */}
      <View style={{flex: 1}}>
        <Tab.Navigator
          id={undefined}
          screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let icon: React.ReactNode;

          // Modern icon rendering with proper styling
          const getModernIcon = (name: string, focused: boolean) => {
            const iconColor = focused ? '#6366F1' : '#8E8E93';
            const iconSize = 24;

            switch (name) {
              case 'Calendar':
                return (
                  <View style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                      width: iconSize,
                      height: iconSize,
                      borderWidth: 2,
                      borderColor: iconColor,
                      borderRadius: 4,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <View style={{
                        width: 12,
                        height: 2,
                        backgroundColor: iconColor,
                        borderRadius: 1,
                        marginTop: -4,
                      }} />
                    </View>
                  </View>
                );
              case 'Household':
                return (
                  <View style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
                    {/* Two overlapping circles for people */}
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                    }}>
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: iconColor,
                        marginRight: -4,
                        zIndex: 1,
                      }} />
                      <View style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: iconColor,
                      }} />
                    </View>
                  </View>
                );
              case 'Notifications':
                return (
                  <View style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                      width: 14,
                      height: 16,
                      backgroundColor: iconColor,
                      borderRadius: 3,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      paddingTop: 2,
                    }}>
                      <View style={{
                        width: 2,
                        height: 2,
                        backgroundColor: focused ? '#0F0F23' : '#0F0F23',
                      }} />
                    </View>
                    {unreadCount > 0 && (
                      <View style={{
                        position: 'absolute',
                        width: 6,
                        height: 6,
                        backgroundColor: '#DC2626',
                        borderRadius: 3,
                        top: 2,
                        right: 0,
                      }} />
                    )}
                  </View>
                );
              case 'Profile':
                return (
                  <View style={{ width: iconSize, height: iconSize, justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: iconColor,
                      marginBottom: 2,
                    }} />
                    <View style={{
                      width: 14,
                      height: 9,
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                      backgroundColor: iconColor,
                    }} />
                  </View>
                );
              default:
                return <Text style={{ fontSize: 18 }}>?</Text>;
            }
          };

          return (
            <View style={{
              width: 70,
              height: 60,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 12,
              backgroundColor: focused ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
            }}>
              {getModernIcon(route.name, focused)}
            </View>
          );
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#0F0F23',
          borderTopColor: 'rgba(99, 102, 241, 0.2)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'android' ? navDimensions.tabBarPaddingBottom : insets.bottom + 6,
          paddingTop: navDimensions.tabBarPaddingTop,
          paddingHorizontal: 8,
          height: navDimensions.tabBarHeight,
          // Modern glassmorphism effect
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -4},
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 12,
          position: 'relative',
          zIndex: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
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
      </View>

    {/* Ad Banner - positioned directly above nav bar with no gap */}
    <View style={{
      width: '100%',
      height: navDimensions.adBannerHeight,
      zIndex: 5,
      marginTop: 0,
    }}>
      <AdBanner 
        safeAreaBottom={0}
        showPlaceholder={true}
      />
    </View>
    </View>
  );
};
