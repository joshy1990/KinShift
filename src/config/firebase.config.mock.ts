// Mock Firebase config for testing
export const firebaseConfig = {
  apiKey: 'mock-api-key',
  authDomain: 'mock-project.firebaseapp.com',
  projectId: 'mock-project',
  storageBucket: 'mock-project.appspot.com',
  messagingSenderId: '123456789',
  appId: 'mock-app-id',
  measurementId: 'mock-measurement-id',
};

// Collection names remain the same
export const COLLECTIONS = {
  USERS: 'users',
  HOUSEHOLDS: 'households',
  SHIFTS: 'shifts',
  INVITES: 'invites',
  CONFLICTS: 'conflicts',
  NOTIFICATIONS: 'notifications',
  OFFLINE_EDITS: 'offlineEdits',
} as const;

// Other config remains the same...
export const JOIN_CODE_LENGTH = 8;
export const JOIN_CODE_EXPIRY_DAYS = 30;

export const NOTIFICATION_CHANNELS = {
  SHIFTS: 'shifts',
  CONFLICTS: 'conflicts',
  INVITES: 'invites',
  GENERAL: 'general',
} as const;

export const SYNC_INTERVAL_MS = 30000;
export const OFFLINE_RETRY_MAX = 3;
export const OFFLINE_RETRY_DELAY_MS = 5000;

export const APP_VERSION = '0.1.0';
export const APP_NAME = 'Family LinkShift';