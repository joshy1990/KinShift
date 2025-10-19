/**
 * Notification Service
 * Handles all notification operations
 * Uses Expo Notifications for push + Firestore for storage
 */

import * as Notifications from 'expo-notifications';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase.config';
import { Notification } from '@/types';
import {
  shiftCreatedTemplate,
  shiftUpdatedTemplate,
  shiftDeletedTemplate,
  invitationTemplate,
  messageTemplate,
  subscriptionDowngradeTemplate,
  subscriptionCanceledTemplate,
  templateToNotification,
  NotificationPayload,
} from '@/utils/notificationTemplates';
import {
  getPushToken,
  registerPushToken,
  unregisterPushToken,
  getUserTokens,
  initializePushNotifications,
} from '@/utils/pushTokenManager';

// Configure notifications behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ========================================
// NOTIFICATION INITIALIZATION
// ========================================

/**
 * Initialize notifications for user
 */
const initialize = async (userId: string): Promise<boolean> => {
  try {
    const { success } = await initializePushNotifications(userId);
    return success;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return false;
  }
};

/**
 * Cleanup notifications on logout
 */
const cleanup = async (userId: string): Promise<void> => {
  try {
    const token = await getPushToken();
    if (token) {
      await unregisterPushToken(userId, token);
    }
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
  }
};

/**
 * Check notification permission
 */
const checkPermission = async (): Promise<string> => {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.granted) {
      return 'granted';
    }
    return 'denied';
  } catch (error) {
    console.error('Error checking permission:', error);
    return 'denied';
  }
};

/**
 * Request notification permission
 */
const requestPermission = async (): Promise<boolean> => {
  try {
    const permission = await Notifications.requestPermissionsAsync();
    return permission.granted;
  } catch (error) {
    console.error('Error requesting permission:', error);
    return false;
  }
};

// ========================================
// NOTIFICATION STORAGE
// ========================================

/**
 * Create notification in Firestore
 */
const createNotification = async (
  notification: Omit<Notification, 'id'>
): Promise<string | null> => {
  try {
    const notificationRef = collection(db, 'notifications');
    const docRef = await addDoc(notificationRef, {
      ...notification,
      createdAt: new Date(),
      read: false,
    });

    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Get user notifications
 */
const getUserNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const notificationQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(notificationQuery);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Notification));
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

/**
 * Listen to real-time notifications
 */
const listenToUserNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  try {
    const notificationQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationQuery, (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Notification));

      callback(notifications);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Error listening to notifications:', error);
    return () => {};
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
    });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Mark all notifications as read for user
 */
const markAllAsRead = async (userId: string): Promise<boolean> => {
  try {
    const batch = writeBatch(db);

    const notificationQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(notificationQuery);

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error marking all as read:', error);
    return false;
  }
};

/**
 * Delete notification
 */
const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

// ========================================
// PUSH NOTIFICATIONS
// ========================================

/**
 * Register device token
 */
const registerDeviceToken = async (userId: string, householdId: string): Promise<boolean> => {
  try {
    const token = await getPushToken();
    if (!token) {
      console.warn('No push token available');
      return false;
    }
    await registerPushToken(userId, token);
    return true;
  } catch (error) {
    console.error('Error registering device token:', error);
    return false;
  }
};

/**
 * Send push notification to user(s)
 * Note: In production, this would use a backend to send via Expo's push service
 * For now, we store the notification in Firestore and let the app handle it locally
 */
const sendPushNotificationToUser = async (
  userId: string,
  payload: NotificationPayload
): Promise<boolean> => {
  try {
    // In a production app, you would:
    // 1. Call your backend API
    // 2. Backend uses expo-server-sdk to send push via Expo's service
    // 3. Or use Firebase Cloud Messaging
    // 
    // For now, we log that we would send it
    // The notification has already been saved to Firestore via createNotification()
    
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
};

// ========================================
// SPECIFIC NOTIFICATION TYPES
// ========================================

/**
 * Notify household members about shift creation
 */
const notifyShiftCreated = async (shift: any, household: any, creatorName?: string): Promise<void> => {
  try {
    const payload = shiftCreatedTemplate(
      creatorName || 'Team Member',
      shift.shiftType || 'shift',
      new Date(shift.startTime).toLocaleDateString(),
      household.name,
      shift.id
    );

    // Notify each household member (except creator)
    for (const memberId of household.members || []) {
      if (memberId !== shift.ownerId) {
        // Create Firestore notification
        const notification = templateToNotification(
          memberId,
          household.id,
          payload,
          'shift_created'
        );
        const notificationId = await createNotification(notification);

        // Send push notification
        if (notificationId) {
          await sendPushNotificationToUser(memberId, payload);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying shift created:', error);
  }
};

/**
 * Notify household members about multiple shifts creation
 */
const notifyMultipleShiftsCreated = async (
  shifts: any[],
  household: any,
  creatorName?: string
): Promise<void> => {
  try {
    const payload = {
      title: '📅 Multiple Shifts Added',
      body: `${creatorName || 'Team Member'} added ${shifts.length} new shifts to ${household.name}`,
      data: {
        type: 'shifts_created',
        householdId: household.id,
        shiftCount: shifts.length.toString(),
      },
    };

    // Notify each household member (except creator)
    for (const memberId of household.members || []) {
      if (memberId !== shifts[0]?.ownerId) {
        const notification = templateToNotification(
          memberId,
          household.id,
          payload as NotificationPayload,
          'shifts_created'
        );
        const notificationId = await createNotification(notification);

        if (notificationId) {
          await sendPushNotificationToUser(memberId, payload as NotificationPayload);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying multiple shifts created:', error);
  }
};

/**
 * Notify user of household invitation
 */
const notifyInvitationAccepted = async (
  invitedUserId: string,
  householdId: string,
  householdName: string,
  memberCount: number
): Promise<void> => {
  try {
    const payload = invitationTemplate(householdName, memberCount, '', householdId);

    const notification = templateToNotification(invitedUserId, householdId, payload, 'invite');
    const notificationId = await createNotification(notification);

    if (notificationId) {
      await sendPushNotificationToUser(invitedUserId, payload);
    }
  } catch (error) {
    console.error('Error notifying invitation:', error);
  }
};

/**
 * Notify household members of downgrade
 */
const notifyHouseholdDowngrade = async (
  householdId: string,
  memberIds: string[],
  previousTier: string,
  newTier: string
): Promise<void> => {
  try {
    // Fetch household data
    const householdDoc = await getDoc(doc(db, 'households', householdId));
    const household = householdDoc.data();

    if (!household) {
      console.warn('Household not found:', householdId);
      return;
    }

    const payload = subscriptionDowngradeTemplate(previousTier, newTier, household.name, householdId);

    // Notify each affected member
    for (const memberId of memberIds) {
      const notification = templateToNotification(
        memberId,
        householdId,
        payload,
        'subscription_downgrade'
      );
      const notificationId = await createNotification(notification);

      if (notificationId) {
        await sendPushNotificationToUser(memberId, payload);
      }
    }
  } catch (error) {
    console.error('Error notifying household downgrade:', error);
  }
};

/**
 * Notify admin of subscription cancellation
 */
const notifySubscriptionCanceled = async (
  userId: string,
  affectedHouseholds: any[]
): Promise<void> => {
  try {
    const payload = subscriptionCanceledTemplate(
      affectedHouseholds.length,
      affectedHouseholds[0]?.name
    );

    // Create notification for primary household
    const primaryHouseholdId = affectedHouseholds[0]?.id || 'unknown';
    const notification = templateToNotification(
      userId,
      primaryHouseholdId,
      payload,
      'subscription_canceled'
    );
    const notificationId = await createNotification(notification);

    if (notificationId) {
      await sendPushNotificationToUser(userId, payload);
    }
  } catch (error) {
    console.error('Error notifying subscription canceled:', error);
  }
};

// ========================================
// HANDLERS
// ========================================

/**
 * Handle notification received while app is in foreground
 */
const onNotificationReceived = (callback: (notification: Notifications.Notification) => void): (() => void) => {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
};

/**
 * Send push notification (generic method)
 */
const sendNotification = async (notification: any): Promise<boolean> => {
  try {
    if (notification.userId && notification.data) {
      return await sendPushNotificationToUser(notification.userId, notification.data);
    }
    return false;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

// ========================================
// EXPORT SERVICE OBJECT
// ========================================

export const notificationService = {
  initialize,
  cleanup,
  checkPermission,
  requestPermission,
  registerDeviceToken,
  getUserNotifications,
  listenToUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  notifyInvitationAccepted,
  notifyHouseholdDowngrade,
  notifySubscriptionCanceled,
  onNotificationReceived,
  sendNotification,
  notifyShiftCreated,
  notifyMultipleShiftsCreated,
};
