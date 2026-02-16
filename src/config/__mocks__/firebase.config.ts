// Mock Firebase config for tests

export const app = {
  name: '[DEFAULT]',
  options: {},
  automaticDataCollectionEnabled: false,
};

export const auth = {
  currentUser: null,
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
};

export const db = {
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
};

export const storage = {
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
  deleteObject: jest.fn(),
};

export const COLLECTIONS = {
  USERS: 'users',
  HOUSEHOLDS: 'households',
  SHIFTS: 'shifts',
  DAY_NOTES: 'dayNotes',
  INVITATIONS: 'invitations',
  NOTIFICATIONS: 'notifications',
  SUBSCRIPTIONS: 'subscriptions',
  SHIFT_MESSAGES: 'shiftMessages',
  DAY_MESSAGES: 'dayMessages',
};

// Household join code configuration
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_EXPIRY_DAYS = 2;

export const firebaseConfig = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test.appspot.com',
  messagingSenderId: '123456789',
  appId: 'test-app-id',
};

export default { app, auth, db, storage, COLLECTIONS, firebaseConfig };
