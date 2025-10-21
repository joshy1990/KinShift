/**
 * Notification Integration Setup
 * Initialize and wire up notifications in the app
 * Called from AuthContext and RootNavigator
 */

import { useEffect, useRef, useState } from 'react';
import { notificationService } from '@/services/notification.service';
import { setupNotificationHandlers, handleInitialNotification } from '@/utils/notificationHandlers';
import { notificationSubscriptionManager } from '@/utils/notificationSubscriptions';

// ========================================
// NOTIFICATION INTEGRATION HOOK
// ========================================

/**
 * Hook to setup notifications when user logs in
 * Call this from useEffect in AuthContext or in RootNavigator
 */
export const useNotificationSetup = (userId: string | null | undefined, navigationCallback?: (deepLink: string) => void) => {
  const handlersCleanupRef = useRef<(() => void) | null>(null);
  const initializationRef = useRef(false);

  useEffect(() => {
    if (!userId || initializationRef.current) {
      return;
    }

    initializationRef.current = true;

    const setupNotifications = async () => {
      try {
        // 1. Request permission
        const hasPermission = await notificationService.requestPermission();
        if (__DEV__) {
          console.log('📱 Notification permission:', hasPermission ? 'granted' : 'denied');
        }

        // 2. Initialize notifications
        const initialized = await notificationService.initialize(userId);
        if (__DEV__) {
          console.log('🔔 Notifications initialized:', initialized);
        }

        // 3. Handle notification that launched the app
        await handleInitialNotification(navigationCallback);

        // 4. Setup handlers for foreground/background
        const cleanup = setupNotificationHandlers(navigationCallback);
        handlersCleanupRef.current = cleanup;

        console.log('✅ Notification system ready');
      } catch (error) {
        console.error('❌ Error setting up notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      // Cleanup on unmount or userId change
      if (handlersCleanupRef.current) {
        handlersCleanupRef.current();
      }
    };
  }, [userId, navigationCallback]);
};

/**
 * Hook to listen to user notifications in real-time
 * Returns { notifications, unreadCount, isLoading, error }
 */
export const useNotifications = (userId: string | null | undefined, unreadOnly: boolean = false) => {
  const [state, setState] = useState<any>({
    notifications: [],
    unreadCount: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!userId) {
      setState({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev: any) => ({ ...prev, isLoading: true }));

    const unsubscribe = notificationSubscriptionManager.subscribeToNotifications(
      userId,
      (newState) => {
        setState(newState);
      },
      { unreadOnly }
    );

    return () => {
      unsubscribe();
      notificationSubscriptionManager.unsubscribe(userId, unreadOnly);
    };
  }, [userId, unreadOnly]);

  return state;
};

/**
 * Hook to mark notifications as read
 */
export const useMarkNotificationAsRead = () => {
  return async (notificationId: string) => {
    return await notificationService.markAsRead(notificationId);
  };
};

// ========================================
// MANUAL SETUP FUNCTIONS (if not using hooks)
// ========================================

/**
 * Setup notifications manually (alternative to hook)
 */
export const setupNotificationsManually = async (
  userId: string,
  navigationCallback?: (deepLink: string) => void
): Promise<() => void> => {
  try {
    // 1. Request permission
    const hasPermission = await notificationService.requestPermission();
    console.log('📱 Notification permission:', hasPermission ? 'granted' : 'denied');

    // 2. Initialize notifications
    const initialized = await notificationService.initialize(userId);
    console.log('🔔 Notifications initialized:', initialized);

    // 3. Handle notification that launched the app
    await handleInitialNotification(navigationCallback);

    // 4. Setup handlers
    const cleanup = setupNotificationHandlers(navigationCallback);

    console.log('✅ Notification system ready');

    // Return cleanup function
    return () => {
      cleanup();
      notificationService.cleanup(userId);
      notificationSubscriptionManager.unsubscribeAll();
    };
  } catch (error) {
    console.error('❌ Error setting up notifications:', error);
    return () => {};
  }
};

/**
 * Cleanup notifications manually (alternative to hook)
 */
export const cleanupNotificationsManually = async (userId: string): Promise<void> => {
  try {
    await notificationService.cleanup(userId);
    notificationSubscriptionManager.unsubscribeAll();
    console.log('✅ Notifications cleaned up');
  } catch (error) {
    console.error('❌ Error cleaning up notifications:', error);
  }
};

// ========================================
// NOTIFICATION SCREEN INTEGRATION
// ========================================

/**
 * Configuration for NotificationsScreen component
 */
export const notificationScreenConfig = {
  // Real-time notification list
  useNotificationList: (userId: string) => {
    return notificationSubscriptionManager.subscribeToNotifications(userId, (state) => {
      // Update component state with notifications
      return state;
    });
  },

  // Unread notification count for badge
  useUnreadCount: (userId: string) => {
    const state = notificationSubscriptionManager.getCachedState(userId);
    return state?.unreadCount || 0;
  },

  // Mark as read action
  markAsRead: async (notificationId: string) => {
    return await notificationService.markAsRead(notificationId);
  },

  // Mark all as read action
  markAllAsRead: async (userId: string) => {
    return await notificationService.markAllAsRead(userId);
  },

  // Delete notification action
  delete: async (notificationId: string) => {
    return await notificationService.deleteNotification(notificationId);
  },
};
