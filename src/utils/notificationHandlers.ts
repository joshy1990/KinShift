/**
 * Notification Handlers
 * Setup for foreground and background notification handling
 * Handles notification received, notification response (tap), and deep linking
 */

import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { notificationService } from '@/services/notification.service';

// ========================================
// DEEP LINK HANDLING
// ========================================

/**
 * Parse notification data and generate deep link
 */
export const generateDeepLink = (notification: Notifications.Notification): string | null => {
  const data = notification.request.content.data;

  try {
    switch (data.type) {
      case 'shift_created':
      case 'shift_updated':
      case 'shift_edited':
      case 'shift_deleted':
        if (data.shiftId) {
          return `linkshift://shift/${data.shiftId}`;
        }
        break;

      case 'invite':
      case 'invitation_received':
        if (data.invitationCode) {
          return `linkshift://invitation/${data.invitationCode}`;
        }
        break;

      case 'message':
      case 'day_message':
        if (data.shiftId) {
          return `linkshift://shift/${data.shiftId}`;
        }
        break;

      case 'conflict':
      case 'conflict_detected':
        if (data.householdId) {
          return `linkshift://household/${data.householdId}`;
        }
        break;

      case 'subscription_downgrade':
      case 'subscription_canceled':
        return 'linkshift://subscription';

      default:
        if (data.householdId) {
          return `linkshift://household/${data.householdId}`;
        }
    }
  } catch (error) {
    console.error('Error generating deep link:', error);
  }

  return null;
};

// ========================================
// FOREGROUND NOTIFICATION HANDLER
// ========================================

/**
 * Handle notification received while app is in foreground
 * Called automatically for each notification
 */
export const setupForegroundHandler = (): (() => void) => {
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    try {
      console.log('📬 Notification received in foreground:', {
        title: notification.request.content.title,
        type: notification.request.content.data?.type,
      });

      // In foreground, notifications are handled by the system
      // We can add custom logic here if needed (e.g., analytics, UI updates)
    } catch (error) {
      console.error('Error in foreground notification handler:', error);
    }
  });

  return () => subscription.remove();
};

// ========================================
// NOTIFICATION RESPONSE HANDLER (TAP)
// ========================================

/**
 * Handle notification response (user tapped notification)
 */
export const setupNotificationResponseHandler = (
  navigationCallback?: (deepLink: string) => void
): (() => void) => {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    try {
      const notification = response.notification;
      const deepLink = generateDeepLink(notification);

      console.log('📲 Notification tapped:', {
        title: notification.request.content.title,
        deepLink,
      });

      if (deepLink) {
        if (navigationCallback) {
          navigationCallback(deepLink);
        } else {
          // Default: use React Navigation linking
          Linking.openURL(deepLink).catch((err) => {
            console.error('Error opening deep link:', err);
          });
        }
      }

      // Mark as read
      const notificationId = notification.request.identifier;
      if (notificationId) {
        notificationService.markAsRead(notificationId).catch((err) => {
          console.error('Error marking notification as read:', err);
        });
      }
    } catch (error) {
      console.error('Error in notification response handler:', error);
    }
  });

  return () => subscription.remove();
};

// ========================================
// NOTIFICATION INITIALIZATION
// ========================================

/**
 * Setup all notification handlers
 * Returns function to cleanup all handlers
 */
export const setupNotificationHandlers = (
  navigationCallback?: (deepLink: string) => void
): (() => void) => {
  const unsubscribeForeground = setupForegroundHandler();
  const unsubscribeResponse = setupNotificationResponseHandler(navigationCallback);

  // Return cleanup function
  return () => {
    unsubscribeForeground();
    unsubscribeResponse();
  };
};

// ========================================
// NOTIFICATION DEEP LINK CONFIGURATION
// ========================================

/**
 * Configure React Navigation linking with notification deep links
 * This should be used in your navigation configuration
 */
export const notificationLinkingConfiguration = {
  prefixes: ['linkshift://', 'https://linkshift.app'],
  config: {
    screens: {
      // Shift screens
      ShiftDetail: 'shift/:shiftId',
      EditShift: 'shift/:shiftId/edit',

      // Household screens
      HouseholdDetail: 'household/:householdId',
      InvitationAccept: 'invitation/:inviteCode',
      ManageMembers: 'household/:householdId/members',

      // Subscription screens
      Subscription: 'subscription',

      // Calendar
      CalendarView: 'calendar',
      DayDetail: 'calendar/:date',

      // Notifications
      Notifications: 'notifications',
    },
  },
};

// ========================================
// HANDLE INITIAL NOTIFICATION
// ========================================

/**
 * Handle notification that triggered app launch
 * Call this in your app's root component initialization
 */
export const handleInitialNotification = async (
  navigationCallback?: (deepLink: string) => void
): Promise<string | null> => {
  try {
    const notification = await Notifications.getLastNotificationResponseAsync();

    if (notification) {
      const deepLink = generateDeepLink(notification.notification);

      if (deepLink) {
        if (navigationCallback) {
          navigationCallback(deepLink);
        } else {
          Linking.openURL(deepLink).catch((err) => {
            console.error('Error opening deep link from initial notification:', err);
          });
        }
      }

      return deepLink;
    }
  } catch (error) {
    console.error('Error handling initial notification:', error);
  }

  return null;
};
