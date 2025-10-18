/**
 * Firebase Configuration - APK Build
 * This config connects to production Firebase for APK testing
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Suppress Firebase verbose logging
if (process.env.NODE_ENV === 'production') {
  // In production, suppress debug logs from Firebase
  const originalLog = console.log;
  const originalWarn = console.warn;
  
  console.log = function(...args: any[]) {
    // Filter out Firebase webchannel warnings
    if (args[0]?.toString().includes('@firebase/firestore') && 
        args[0]?.toString().includes('WebChannelConnection')) {
      return;
    }
    originalLog.apply(console, args);
  };
  
  console.warn = function(...args: any[]) {
    // Filter out Firebase webchannel warnings
    if (args[0]?.toString().includes('@firebase/firestore') && 
        args[0]?.toString().includes('WebChannelConnection')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

// Production Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBZciC9cOd6UVSjnhnOHsjAOTOA-VI12Yg',
  authDomain: 'linkshift.firebaseapp.com',
  projectId: 'linkshift',
  storageBucket: 'linkshift.firebasestorage.app',
  messagingSenderId: '73936598703',
  appId: '1:73936598703:web:56a3d43f0eb4959eff865a',
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
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
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
