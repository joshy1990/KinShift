/**
 * Real-Time Notification Subscriptions
 * Setup and manage real-time listeners for notifications
 * Handles unread count updates, automatic notification fetching
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/config/firebase.config';
import { Notification } from '@/types';

// ========================================
// TYPES
// ========================================

export interface NotificationSubscriptionState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
}

export type NotificationSubscriptionCallback = (state: NotificationSubscriptionState) => void;

// ========================================
// SUBSCRIPTION MANAGER
// ========================================

class NotificationSubscriptionManager {
  private subscriptions = new Map<string, () => void>();
  private cacheMap = new Map<string, NotificationSubscriptionState>();

  /**
   * Create a real-time subscription for user notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: NotificationSubscriptionCallback,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
    }
  ): () => void {
    const subscriptionKey = `notifications_${userId}_${options?.unreadOnly ? 'unread' : 'all'}`;

    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      return this.subscriptions.get(subscriptionKey)!;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      const constraints: QueryConstraint[] = [where('userId', '==', userId)];

      if (options?.unreadOnly) {
        constraints.push(where('read', '==', false));
      }

      constraints.push(orderBy('createdAt', 'desc'));

      const q = query(collection(db, 'notifications'), ...constraints);

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const notifications = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Notification));

          const unreadCount = notifications.filter((n) => !n.read).length;

          const state: NotificationSubscriptionState = {
            notifications,
            unreadCount,
            isLoading: false,
            error: null,
          };

          // Cache the state
          this.cacheMap.set(subscriptionKey, state);

          // Call callback
          callback(state);
        },
        (error) => {
          console.error('Error listening to notifications:', error);

          const state: NotificationSubscriptionState = {
            notifications: [],
            unreadCount: 0,
            isLoading: false,
            error: error as Error,
          };

          // Cache the error state
          this.cacheMap.set(subscriptionKey, state);

          // Call callback with error
          callback(state);
        }
      );

      // Store unsubscribe function
      const cleanup = () => {
        if (unsubscribe) {
          unsubscribe();
          this.subscriptions.delete(subscriptionKey);
          this.cacheMap.delete(subscriptionKey);
        }
      };

      this.subscriptions.set(subscriptionKey, cleanup);

      return cleanup;
    } catch (error) {
      console.error('Error setting up notification subscription:', error);

      const state: NotificationSubscriptionState = {
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: error as Error,
      };

      callback(state);

      return () => {}; // No-op cleanup
    }
  }

  /**
   * Get cached notification state
   */
  getCachedState(userId: string, unreadOnly: boolean = false): NotificationSubscriptionState | null {
    const subscriptionKey = `notifications_${userId}_${unreadOnly ? 'unread' : 'all'}`;
    return this.cacheMap.get(subscriptionKey) || null;
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(userId: string, unreadOnly: boolean = false): void {
    const subscriptionKey = `notifications_${userId}_${unreadOnly ? 'unread' : 'all'}`;
    const unsubscribe = this.subscriptions.get(subscriptionKey);

    if (unsubscribe) {
      unsubscribe();
    }
  }

  /**
   * Unsubscribe all
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.subscriptions.clear();
    this.cacheMap.clear();
  }
}

// Export singleton instance
export const notificationSubscriptionManager = new NotificationSubscriptionManager();

// ========================================
// HOUSEHOLD NOTIFICATIONS SUBSCRIPTION
// ========================================

/**
 * Subscribe to notifications for a specific household
 * Useful for household-wide notification summaries
 */
export const subscribeToHouseholdNotifications = (
  householdId: string,
  memberIds: string[],
  callback: (notifications: Notification[]) => void
): (() => void) => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('householdId', '==', householdId),
      where('userId', 'in', memberIds),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Notification));

        callback(notifications);
      },
      (error) => {
        console.error('Error listening to household notifications:', error);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to household notifications:', error);
    return () => {};
  }
};

// ========================================
// NOTIFICATION ACTIVITY TRACKING
// ========================================

/**
 * Get notification statistics for a user
 */
export const getNotificationStats = async (userId: string) => {
  try {
    // Total notifications
    const totalQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
    const totalSnapshot = await getDocs(totalQuery);

    // Unread notifications
    const unreadQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const unreadSnapshot = await getDocs(unreadQuery);

    // By type
    const typeQuery = query(collection(db, 'notifications'), where('userId', '==', userId));
    const typeSnapshot = await getDocs(typeQuery);

    const byType: Record<string, number> = {};
    typeSnapshot.docs.forEach((doc) => {
      const data = doc.data() as Notification;
      byType[data.type] = (byType[data.type] || 0) + 1;
    });

    return {
      total: totalSnapshot.size,
      unread: unreadSnapshot.size,
      byType,
      readPercentage: ((totalSnapshot.size - unreadSnapshot.size) / totalSnapshot.size) * 100 || 0,
    };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return {
      total: 0,
      unread: 0,
      byType: {},
      readPercentage: 0,
    };
  }
};

// ========================================
// NOTIFICATION BATCHING
// ========================================

/**
 * Get recent notifications with automatic batching
 * Useful for "new notifications" badge or summaries
 */
export const getRecentNotificationSummary = async (
  userId: string,
  timeWindowMinutes: number = 30
): Promise<{
  count: number;
  types: Record<string, number>;
  hasNewInvitations: boolean;
}> => {
  try {
    const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);

    const types: Record<string, number> = {};
    let hasNewInvitations = false;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as Notification;

      // Check if recent
      const createdAt = new Date(data.createdAt as any);
      if (createdAt >= since) {
        types[data.type] = (types[data.type] || 0) + 1;

        if (data.type === 'invite' || data.type === 'invitation_received') {
          hasNewInvitations = true;
        }
      }
    });

    return {
      count: Object.values(types).reduce((a, b) => a + b, 0),
      types,
      hasNewInvitations,
    };
  } catch (error) {
    console.error('Error getting recent notification summary:', error);
    return {
      count: 0,
      types: {},
      hasNewInvitations: false,
    };
  }
};
