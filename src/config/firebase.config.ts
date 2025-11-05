/**
 * Firebase Configuration - React Native Firebase (Native SDKs)
 * Production-grade Firebase for React Native with native Android/iOS SDKs
 * Scales from 1 to 10M+ users with proper offline support and reliability
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Firebase is auto-initialized from google-services.json (Android) and GoogleService-Info.plist (iOS)
// No manual configuration needed - config comes from native files

// Export Firebase services
export { auth, firestore, storage };

// Firestore instance with settings
export const db = firestore();

// Enable offline persistence (enabled by default in React Native Firebase)
// Configure Firestore settings for optimal performance
db.settings({
  persistence: true, // Offline persistence enabled
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED, // Unlimited cache for better offline support
});

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  HOUSEHOLDS: 'households',
  SHIFTS: 'shifts',
  DAY_NOTES: 'dayNotes',
  SHIFT_MESSAGES: 'shiftMessages',
  DAY_MESSAGES: 'dayMessages',
  INVITATIONS: 'invitations',
  NOTIFICATIONS: 'notifications',
  SUBSCRIPTIONS: 'subscriptions',
};

// Household join code configuration
export const JOIN_CODE_LENGTH = 6;  // 6 characters (displayed as XXX-XXX with dash)
export const JOIN_CODE_EXPIRY_DAYS = 2;
