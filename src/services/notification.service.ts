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
  limit,
  onSnapshot,
  writeBatch,
  getDoc,
} from '@/config/firestore.compat';
import { db } from '@/config/firebase.config';
import { Notification, Shift } from '@/types';
import {
  shiftCreatedTemplate,
  shiftUpdatedTemplate,
  shiftDeletedTemplate,
  subscriptionDowngradeTemplate,
  subscriptionCanceledTemplate,
  dayNoteAddedTemplate,
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

/**
 * Get the user's configured reminder minutes from Firestore
 * Falls back to 30 minutes if not configured
 */
const getUserReminderMinutes = async (userId: string): Promise<{ enabled: boolean; minutes: number }> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const prefs = userDoc.data()?.notificationPreferences;
      if (prefs) {
        return {
          enabled: prefs.shiftReminders !== false,
          minutes: prefs.reminderMinutes || 30,
        };
      }
    }
    return { enabled: true, minutes: 30 };
  } catch (error) {
    console.warn('Failed to read reminder preferences, using defaults:', error);
    return { enabled: true, minutes: 30 };
  }
};

// ========================================
// NOTIFICATION INITIALIZATION
// ========================================

/** TTL for notifications in days */
const NOTIFICATION_TTL_DAYS = 30;

/**
 * Clean up notifications older than TTL
 * Should be called periodically (e.g., on app start)
 */
const cleanupExpiredNotifications = async (userId: string): Promise<number> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_TTL_DAYS);

    const expiredQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('createdAt', '<', cutoffDate)
    );

    const snapshot = await getDocs(expiredQuery);
    if (snapshot.empty) return 0;

    const BATCH_LIMIT = 499;
    let deletedCount = 0;

    for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
      const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      deletedCount += chunk.length;
    }

    console.log(`Cleaned up ${deletedCount} expired notifications`);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired notifications:', error);
    return 0;
  }
};

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
    if (permission.canAskAgain) {
      return 'undetermined';
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
const getUserNotifications = async (userId: string, maxResults: number = 100): Promise<Notification[]> => {
  try {
    const notificationQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
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
/** Maximum notifications to keep in the real-time listener to bound read costs */
const NOTIFICATION_LISTENER_LIMIT = 100;

const listenToUserNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): (() => void) => {
  try {
    const notificationQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(NOTIFICATION_LISTENER_LIMIT)
    );

    const unsubscribe = onSnapshot(
      notificationQuery,
      (snapshot) => {
        const notifications = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Notification));

        callback(notifications);
      },
      (error) => {
        console.error('Notification listener error:', error);
        // Return empty array so the UI can show an appropriate state
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error setting up notification listener:', error);
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
    const notificationQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(notificationQuery);

    if (snapshot.empty) return true;

    // Chunk into batches of 499 to stay under Firestore's 500-operation limit
    const BATCH_LIMIT = 499;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
    }

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
 * 
 * ⚠️ SECURITY NOTE: This calls the Expo Push API directly from the client.
 * In production, push notifications should be sent from a backend server
 * (e.g., Cloud Functions) to prevent token exposure and abuse.
 * This is a simplified implementation for development/MVP.
 * 
 * Rate limiting: Max 10 push notifications per minute per user to prevent abuse.
 */
const pushRateLimit = new Map<string, number[]>();
const PUSH_RATE_LIMIT = 10;
const PUSH_RATE_WINDOW_MS = 60_000;

const sendPushNotificationToUser = async (
  userId: string,
  payload: NotificationPayload
): Promise<boolean> => {
  try {
    // Rate limiting check
    const now = Date.now();
    const userHistory = pushRateLimit.get(userId) || [];
    const recentSends = userHistory.filter(t => now - t < PUSH_RATE_WINDOW_MS);
    if (recentSends.length >= PUSH_RATE_LIMIT) {
      console.warn(`Push rate limit exceeded for user ${userId}. Skipping push (notification still in Firestore).`);
      return true; // Notification is already in Firestore
    }
    pushRateLimit.set(userId, [...recentSends, now]);

    // Get all registered push tokens for the user
    const tokens = await getUserTokens(userId);

    if (!tokens || tokens.length === 0) {
      console.log(`No push tokens registered for user ${userId}. Notification saved to Firestore.`);
      return true; // Still return true since notification was created in Firestore
    }

    // Prepare message for Expo push service
    const messages = tokens
      .filter((token) => token && typeof token === 'string')
      .map((token) => ({
        to: token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        badge: 1,
        priority: 'high',
        channelId: 'default',
      }));

    if (messages.length === 0) {
      console.log(`No valid push tokens for user ${userId}`);
      return true;
    }

    // Send to Expo push service
    // In production, this should be sent from your backend server for security
    // This is a simplified client-side implementation
    const expoApiUrl = 'https://exp.host/--/api/v2/push/send';

    for (const message of messages) {
      try {
        const response = await fetch(expoApiUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();

        if (result.errors) {
          console.warn('Expo push error:', result.errors);
        } else {
          console.log('? Push sent via Expo to token:', message.to.substring(0, 10) + '...');
        }
      } catch (error) {
        console.error('Error sending individual push notification:', error);
      }
    }

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
    const st = shift.startTime?.toDate ? shift.startTime.toDate() : new Date(shift.startTime);
    const payload = shiftCreatedTemplate(
      creatorName || 'Team Member',
      shift.shiftType || 'shift',
      st.toLocaleDateString(),
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
          'shift_created',
          shift.ownerId
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
 * Notify household members about shift update
 */
const notifyShiftUpdated = async (
  shift: any,
  household: any,
  updaterName?: string
): Promise<void> => {
  try {
    const st = shift.startTime?.toDate ? shift.startTime.toDate() : new Date(shift.startTime);
    const payload = shiftUpdatedTemplate(
      updaterName || 'Team Member',
      shift.shiftType || 'shift',
      st.toLocaleDateString(),
      household.name,
      shift.id
    );

    // Only owners edit their own shifts, so ownerId is always the updater
    for (const memberId of household.members || []) {
      if (memberId !== shift.ownerId) {
        // Create Firestore notification
        const notification = templateToNotification(
          memberId,
          household.id,
          payload,
          'shift_updated',
          shift.ownerId
        );
        const notificationId = await createNotification(notification);

        // Send push notification
        if (notificationId) {
          await sendPushNotificationToUser(memberId, payload);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying shift updated:', error);
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
      title: '?? Multiple Shifts Added',
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
 * Notify household members about a deleted shift
 */
const notifyShiftDeleted = async (
  params: {
    householdId: string;
    shift: Pick<Shift, 'id' | 'shiftType'> & { startTime: Date | { toDate(): Date } | any };
    deleterId: string;
    deleterName: string;
  }
): Promise<void> => {
  const {householdId, shift, deleterId, deleterName} = params;

  try {
    const householdDoc = await getDoc(doc(db, 'households', householdId));
    const household = householdDoc.data();

    if (!household) {
      console.warn('Household not found for shift deletion notification:', householdId);
      return;
    }

    const shiftType = shift.shiftType || 'custom';
    const shiftTypeLabel = `${shiftType.charAt(0).toUpperCase()}${shiftType.slice(1)}`;
    const st = shift.startTime?.toDate ? shift.startTime.toDate() : new Date(shift.startTime);
    const dateString = st.toLocaleDateString();
    const payload = shiftDeletedTemplate(
      deleterName,
      shiftTypeLabel,
      dateString,
      household.name || 'Household'
    );

    for (const memberId of household.members || []) {
      if (memberId === deleterId) {
        continue;
      }

      const notification = templateToNotification(
        memberId,
        householdId,
        payload,
        'shift_deleted'
      );
      const notificationId = await createNotification(notification);

      if (notificationId) {
        await sendPushNotificationToUser(memberId, payload);
      }
    }
  } catch (error) {
    console.error('Error notifying shift deleted:', error);
  }
};

/**
 * Notify user of household invitation received
 */
const notifyInvitationReceived = async (
  invitedUserId: string,
  householdId: string,
  householdName: string,
  inviterName: string
): Promise<void> => {
  try {
    const payload = {
      title: 'Household Invitation',
      body: `${inviterName} invited you to join "${householdName}"`,
      data: { householdId, type: 'invitation_received' },
    };

    const notification = templateToNotification(invitedUserId, householdId, payload, 'invitation_received');
    const notificationId = await createNotification(notification);

    if (notificationId) {
      await sendPushNotificationToUser(invitedUserId, payload);
    }
  } catch (error) {
    console.error('Error notifying invitation received:', error);
  }
};

/**
 * Notify user of household invitation accepted
 */
const notifyInvitationAccepted = async (
  invitedUserId: string,
  householdId: string,
  householdName: string,
  memberCount: number
): Promise<void> => {
  try {
    const payload = {
      title: `Welcome to ${householdName}!`,
      body: `Your invitation was accepted. You've joined ${memberCount} other member${memberCount !== 1 ? 's' : ''}.`,
      data: {
        type: 'invitation_accepted',
        householdId,
        actionUrl: `/household/${householdId}`,
      },
    };

    const notification = templateToNotification(invitedUserId, householdId, payload, 'invite');
    const notificationId = await createNotification(notification);

    if (notificationId) {
      await sendPushNotificationToUser(invitedUserId, payload);
    }
  } catch (error) {
    console.error('Error notifying invitation accepted:', error);
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
    if (!affectedHouseholds || affectedHouseholds.length === 0) {
      console.warn('notifySubscriptionCanceled called with no affected households');
      return;
    }

    const payload = subscriptionCanceledTemplate(
      affectedHouseholds.length,
      affectedHouseholds[0].name
    );

    // Create notification for primary household
    const primaryHouseholdId = affectedHouseholds[0].id;
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
// SHIFT REMINDERS (Local Notifications)
// ========================================

/**
 * Schedule a local notification reminder before a shift starts.
 * Reads the user's preferred reminder timing from Firestore.
 * If userId is provided, reads their reminderMinutes preference.
 * If shiftReminders is disabled in preferences, skips scheduling.
 *
 * @param shift - The shift to schedule a reminder for
 * @param userId - The user's ID to read reminder preferences from Firestore
 * @returns The scheduled notification identifier, or null on failure
 */
const scheduleShiftReminder = async (
  shift: { id: string; title: string; shiftType: string; startTime: Date | any },
  userId?: string
): Promise<string | null> => {
  try {
    // Cancel any existing scheduled reminders for this shift to prevent duplicates.
    // Each call to scheduleShiftReminder (from create or edit) would otherwise
    // accumulate additional notifications for the same shift.
    try {
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      const staleReminders = allScheduled.filter(
        (n) => n.content.data?.type === 'shift_reminder' && n.content.data?.shiftId === shift.id
      );
      for (const stale of staleReminders) {
        await Notifications.cancelScheduledNotificationAsync(stale.identifier);
      }
      if (staleReminders.length > 0) {
        console.log(`Cancelled ${staleReminders.length} existing reminder(s) for shift ${shift.id}`);
      }
    } catch (cancelError) {
      console.warn('Failed to cancel existing reminders, continuing:', cancelError);
    }

    // Read user's reminder preference from Firestore
    let minutesBefore = 30;
    if (userId) {
      const prefs = await getUserReminderMinutes(userId);
      if (!prefs.enabled) {
        console.log('Shift reminders disabled by user preference');
        return null;
      }
      minutesBefore = prefs.minutes;
    }
    // Parse shift start time
    let startDate: Date;
    if (shift.startTime && typeof shift.startTime === 'object' && 'seconds' in shift.startTime) {
      startDate = new Date((shift.startTime as any).seconds * 1000);
    } else {
      startDate = new Date(shift.startTime);
    }

    // Calculate trigger time (X minutes before shift)
    const triggerTime = new Date(startDate.getTime() - minutesBefore * 60 * 1000);

    // Don't schedule if the reminder time is already past
    if (triggerTime <= new Date()) {
      console.log('Shift reminder time already passed, skipping schedule');
      return null;
    }

    const timeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Shift starting soon`,
        body: `Your ${shift.shiftType || 'shift'} "${shift.title}" starts at ${timeStr}`,
        data: {
          type: 'shift_reminder',
          shiftId: shift.id,
        },
        sound: 'default',        ...(require('react-native').Platform.OS === 'android' ? { channelId: 'reminders' } : {}),      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerTime,
      },
    });

    console.log(`Shift reminder scheduled for ${triggerTime.toISOString()} (${minutesBefore}min before)`);
    return identifier;
  } catch (error) {
    console.error('Error scheduling shift reminder:', error);
    return null;
  }
};

/**
 * Cancel a previously scheduled shift reminder
 */
const cancelShiftReminder = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error cancelling shift reminder:', error);
  }
};

/**
 * Notify household members when a day note is added
 */
const notifyDayNoteAdded = async (
  noteId: string,
  authorName: string,
  date: string,
  householdId: string,
  authorId: string
): Promise<void> => {
  try {
    // Get household members
    const householdRef = doc(db, 'households', householdId);
    const householdSnap = await getDoc(householdRef);
    if (!householdSnap.exists()) return;

    const householdData = householdSnap.data();
    const members: string[] = householdData?.members || [];

    const payload = dayNoteAddedTemplate(authorName, date, noteId);

    // Notify each household member (except the author)
    for (const memberId of members) {
      if (memberId !== authorId) {
        const notification = templateToNotification(
          memberId,
          householdId,
          payload,
          'day_note_added'
        );
        const notificationId = await createNotification(notification);

        if (notificationId) {
          await sendPushNotificationToUser(memberId, payload);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying day note added:', error);
  }
};

// ========================================
// EXPORT SERVICE OBJECT
// ========================================

export const notificationService = {
  initialize,
  cleanup,
  cleanupExpiredNotifications,
  checkPermission,
  requestPermission,
  registerDeviceToken,
  getUserNotifications,
  listenToUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  notifyInvitationReceived,
  notifyInvitationAccepted,
  notifyHouseholdDowngrade,
  notifySubscriptionCanceled,
  onNotificationReceived,
  sendNotification,
  notifyShiftCreated,
  notifyShiftUpdated,
  notifyMultipleShiftsCreated,
  notifyShiftDeleted,
  notifyDayNoteAdded,
  scheduleShiftReminder,
  cancelShiftReminder,
  sendPushToUser: sendPushNotificationToUser,
};
