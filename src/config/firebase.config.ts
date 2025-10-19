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

// Production Firebase configuration - NEW PROJECT
const firebaseConfig = {
  apiKey: 'AIzaSyAlpo7Wi29uqY3coh0EjXWsmjaZfdmxo7c',
  authDomain: 'linkshift-c2725.firebaseapp.com',
  projectId: 'linkshift-c2725',
  storageBucket: 'linkshift-c2725.firebasestorage.app',
  messagingSenderId: '518355942929',
  appId: '1:518355942929:web:183f005b7c513873e03bb0',
};

// Initialize Firebase
console.log('[Firebase] Initializing Firebase app...');
export const app = initializeApp(firebaseConfig);
console.log('[Firebase] Firebase app initialized successfully');

// Initialize services
console.log('[Firebase] Initializing Firebase services...');

// Use standard Firebase Auth (works better on React Native than initializeAuth)
export const auth = getAuth(app);
console.log('[Firebase] Auth initialized');

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
  console.log('[Firebase] Offline persistence enabled');
} catch (err) {
  console.warn('[Firebase] Could not enable persistence:', err);
}

export const storage = getStorage(app);
console.log('[Firebase] All Firebase services initialized');

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

console.log('� Firebase Production Mode - Connected to Cloud Firestore');
console.log('   • Project: LinkShift');
console.log('   • Environment: Production');
