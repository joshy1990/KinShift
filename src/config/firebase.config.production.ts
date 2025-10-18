// Firebase configuration
// Replace these values with your actual Firebase project configuration
// Get these from Firebase Console > Project Settings > Your apps

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBZciC9cOd6UVSjnhnOHsjAOTOA-VI12Yg",
  authDomain: "LinkShift.firebaseapp.com",
  projectId: "LinkShift",
  storageBucket: "LinkShift.firebasestorage.app",
  messagingSenderId: "73936598703",
  appId: "1:73936598703:web:56a3d43f0eb4959eff865a",
  measurementId: "G-7SRHBB8C47"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Note: Analytics only works on web, not in Expo Go
// const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  HOUSEHOLDS: 'households',
  SHIFTS: 'shifts',
  INVITES: 'invites',
  CONFLICTS: 'conflicts',
  NOTIFICATIONS: 'notifications',
  OFFLINE_EDITS: 'offlineEdits',
  DAY_NOTES: 'dayNotes',
  DAY_MESSAGES: 'dayMessages',
  SUBSCRIPTIONS: 'subscriptions',
} as const;

// Household join code configuration
export const JOIN_CODE_LENGTH = 8;
export const JOIN_CODE_EXPIRY_DAYS = 30;

// Notification settings
export const NOTIFICATION_CHANNELS = {
  SHIFTS: 'shifts',
  CONFLICTS: 'conflicts',
  INVITES: 'invites',
  GENERAL: 'general',
} as const;

// Sync settings
export const SYNC_INTERVAL_MS = 30000; // 30 seconds
export const OFFLINE_RETRY_MAX = 3;
export const OFFLINE_RETRY_DELAY_MS = 5000;

// App settings
export const APP_VERSION = '0.1.0';
export const APP_NAME = 'Family LinkShift';
