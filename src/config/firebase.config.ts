/**
 * Firebase Configuration - APK Build
 * This config connects to production Firebase for APK testing
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// CRITICAL: Disable WebChannel BEFORE Firebase initialization
// This prevents 400 errors and forces long-polling from the start
(globalThis as any).__FIREBASE_DEFAULTS__ = {
  config: {
    useEmulator: false,
  },
};

// Disable WebChannel by setting transport
(globalThis as any).__FIREBASE_TRANSPORT__ = 'http';

// Suppress WebChannel errors in console (they're cosmetic, not functional)
const originalError = console.error;
const originalWarn = console.warn;
console.error = function(...args: any[]) {
  const message = args[0]?.toString?.() || '';
  // Suppress WebChannel errors - they're expected with long-polling fallback
  if (!message.includes('WebChannel') && !message.includes('0x52693830')) {
    originalError.apply(console, args);
  }
};
console.warn = function(...args: any[]) {
  const message = args[0]?.toString?.() || '';
  // Allow warnings through, but could filter here if needed
  originalWarn.apply(console, args);
};

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Validate that all required config values are present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[Firebase] Missing required configuration. Check your .env.local file.');
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize services
// Use standard Firebase Auth (works better on React Native than initializeAuth)
export const auth = getAuth(app);

// Firestore settings for React Native (avoid WebSockets on some Android networks)
// Force long-polling only, disable all other transports
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  ignoreUndefinedProperties: true,
  cacheSizeBytes: 50 * 1024 * 1024, // 50MB cache
});

// Enable offline persistence for better reliability
try {
  enableIndexedDbPersistence(db).catch((err) => {
    // Persistence might already be enabled, ignore
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('[Firebase] Persistence error:', err);
    }
  });
} catch (err) {
  console.warn('[Firebase] Could not enable persistence:', err);
}

export const storage = getStorage(app);

// Production Firebase - No emulator connections

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
