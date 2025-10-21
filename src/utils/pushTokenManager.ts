/**
 * Push Token Manager
 * Handles registration, storage, and cleanup of push tokens
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase.config';

const STORAGE_KEY = 'expo_push_token';
const MAX_TOKENS_PER_USER = 5; // Prevent unlimited token accumulation

export interface PushTokenInfo {
  token: string;
  deviceId: string;
  createdAt: Date;
  lastUsed: Date;
  platform: 'ios' | 'android' | 'web';
}

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

    // Get push token
    const projectId = '___'; // Will be set by Expo
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
 * Register push token for user in Firestore
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
    const userDocRef = doc(db, 'users', userId);
    const tokenInfo: PushTokenInfo = {
      token,
      deviceId: `${platform}-${Date.now()}`, // Simple device ID
      createdAt: new Date(),
      lastUsed: new Date(),
      platform,
    };

    // Add token to user's pushTokens array
    await updateDoc(userDocRef, {
      pushTokens: arrayUnion(tokenInfo),
      updatedAt: new Date(),
    });

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
    const userDocRef = doc(db, 'users', userId);

    // Remove token from user's pushTokens array
    await updateDoc(userDocRef, {
      pushTokens: arrayRemove({ token } as any),
      updatedAt: new Date(),
    });

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
 * Get all tokens for a user
 */
export const getUserTokens = async (userId: string): Promise<string[]> => {
  if (!userId) {
    return [];
  }

  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return [];
    }

    const pushTokens = userDoc.data()?.pushTokens || [];
    return pushTokens.map((t: any) => t.token).filter((t: string) => !!t);
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
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return false;
    }

    const pushTokens = userDoc.data()?.pushTokens || [];
    const updatedTokens = pushTokens.map((t: any) =>
      t.token === token ? { ...t, lastUsed: new Date() } : t
    );

    await updateDoc(userDocRef, {
      pushTokens: updatedTokens,
      updatedAt: new Date(),
    });

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
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return 0;
    }

    const pushTokens = (userDoc.data()?.pushTokens || []) as PushTokenInfo[];

    // Sort by lastUsed, keep only most recent MAX_TOKENS_PER_USER
    const sortedTokens = pushTokens
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
      .slice(0, MAX_TOKENS_PER_USER);

    const removedCount = pushTokens.length - sortedTokens.length;

    if (removedCount > 0) {
      await updateDoc(userDocRef, {
        pushTokens: sortedTokens,
        updatedAt: new Date(),
      });

      console.log(`✅ Cleaned up ${removedCount} old tokens`);
    }

    return removedCount;
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
