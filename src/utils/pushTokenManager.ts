/**
 * Push Token Manager
 * Handles registration, storage, and cleanup of push tokens
 * 
 * Tokens are stored in a private subcollection: users/{userId}/pushTokens/{tokenId}
 * This prevents other authenticated users from reading push tokens.
 * Cloud Functions use Admin SDK (bypasses rules) for server-side reads.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/config/firebase.config';
import Constants from 'expo-constants';

const STORAGE_KEY = 'expo_push_token';
const MAX_TOKENS_PER_USER = 5; // Prevent unlimited token accumulation

export interface PushTokenInfo {
  token: string;
  deviceId: string;
  createdAt: Date;
  lastUsed: Date;
  platform: 'ios' | 'android' | 'web';
}

/** Subcollection ref for a user's push tokens */
const pushTokensCollection = (userId: string) =>
  db.collection('users').doc(userId).collection('pushTokens');

/**
 * Get current push token
 */
export const getPushToken = async (): Promise<string | null> => {
  try {
    // Check if permission is granted
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    // Get push token using EAS project ID from app config
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('EAS projectId not found in app config — push tokens will not work');
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Register push token for user in Firestore subcollection
 */
export const registerPushToken = async (
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web' = 'android'
): Promise<boolean> => {
  if (!userId || !token) {
    console.warn('Invalid userId or token');
    return false;
  }

  try {
    const colRef = pushTokensCollection(userId);

    // Check if this token already exists
    const existing = await colRef.where('token', '==', token).get();
    if (!existing.empty) {
      // Update lastUsed on the existing doc
      await existing.docs[0].ref.update({ lastUsed: new Date() });
    } else {
      const tokenInfo: PushTokenInfo = {
        token,
        deviceId: `${platform}-${Date.now()}`,
        createdAt: new Date(),
        lastUsed: new Date(),
        platform,
      };
      await colRef.add(tokenInfo);
    }

    // Store locally for reference
    await AsyncStorage.setItem(STORAGE_KEY, token);

    if (__DEV__) {
      console.log('✅ Push token registered:', token);
    }
    return true;
  } catch (error) {
    console.error('Error registering push token:', error);
    return false;
  }
};

/**
 * Unregister push token for user
 */
export const unregisterPushToken = async (
  userId: string,
  token: string
): Promise<boolean> => {
  if (!userId || !token) {
    console.warn('Invalid userId or token');
    return false;
  }

  try {
    const colRef = pushTokensCollection(userId);
    const snapshot = await colRef.where('token', '==', token).get();
    for (const tokenDoc of snapshot.docs) {
      await tokenDoc.ref.delete();
    }

    // Clear from local storage
    await AsyncStorage.removeItem(STORAGE_KEY);

    if (__DEV__) {
      console.log('✅ Push token unregistered:', token);
    }
    return true;
  } catch (error) {
    console.error('Error unregistering push token:', error);
    return false;
  }
};

/**
 * Get all tokens for a user (reads from subcollection)
 */
export const getUserTokens = async (userId: string): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const snapshot = await pushTokensCollection(userId).get();
    return snapshot.docs
      .map((d: any) => d.data()?.token)
      .filter((t: string) => !!t);
  } catch (error) {
    console.error('Error getting user tokens:', error);
    return [];
  }
};

/**
 * Update last used time for a token
 */
export const updateTokenLastUsed = async (userId: string, token: string): Promise<boolean> => {
  if (!userId || !token) {
    return false;
  }

  try {
    const snapshot = await pushTokensCollection(userId).where('token', '==', token).get();
    if (snapshot.empty) return false;
    await snapshot.docs[0].ref.update({ lastUsed: new Date() });
    return true;
  } catch (error) {
    console.error('Error updating token last used:', error);
    return false;
  }
};

/**
 * Cleanup old/invalid tokens for a user
 */
export const cleanupOldTokens = async (userId: string): Promise<number> => {
  if (!userId) {
    return 0;
  }

  try {
    const snapshot = await pushTokensCollection(userId).get();
    const docs = snapshot.docs.map((d: any) => ({ id: d.id, ref: d.ref, ...d.data() }));

    if (docs.length <= MAX_TOKENS_PER_USER) return 0;

    // Sort by lastUsed descending, keep most recent
    docs.sort((a: any, b: any) =>
      new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    );
    const toRemove = docs.slice(MAX_TOKENS_PER_USER);

    for (const tokenDoc of toRemove) {
      await tokenDoc.ref.delete();
    }

    console.log(`✅ Cleaned up ${toRemove.length} old tokens`);
    return toRemove.length;
  } catch (error) {
    console.error('Error cleaning up tokens:', error);
    return 0;
  }
};

/**
 * Get locally stored token
 */
export const getStoredToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error getting stored token:', error);
    return null;
  }
};

/**
 * Listen for token changes (when app returns to foreground)
 */
export const setupTokenRefreshListener = (
  userId: string,
  callback: (token: string) => void
): (() => void) => {
  const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
    // Get fresh token
    const token = await getPushToken();
    if (token) {
      callback(token);
    }
  });

  return () => {
    subscription.remove();
  };
};

/**
 * Initialize push notifications
 */
export const initializePushNotifications = async (
  userId: string
): Promise<{ token: string | null; success: boolean }> => {
  try {
    // Set up Android notification channel (required for Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'KinShift Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Shift Reminders',
        description: 'Reminders before your shifts start',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F59E0B',
        sound: 'default',
      });
    }

    // Request permissions
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return { token: null, success: false };
    }

    // Get push token
    const token = await getPushToken();

    if (!token) {
      console.warn('Could not get push token');
      return { token: null, success: false };
    }

    // Register in Firestore
    const registered = await registerPushToken(userId, token);

    if (!registered) {
      console.warn('Could not register push token');
      return { token, success: false };
    }

    // Cleanup old tokens
    await cleanupOldTokens(userId);

    return { token, success: true };
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return { token: null, success: false };
  }
};
