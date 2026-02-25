// Jest setup file for tests
// Mock React Native Firebase for testing

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    currentUser: null,
    createUserWithEmailAndPassword: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    onAuthStateChanged: jest.fn(),
  })),
  EmailAuthProvider: {
    credential: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/firestore', () => {
  const mockCollection = jest.fn(() => mockCollection);
  const mockDoc = jest.fn(() => mockDoc);
  const mockGet = jest.fn(() => Promise.resolve({ exists: true, id: 'mock-id', data: () => ({}) }));
  
  mockCollection.doc = mockDoc;
  mockCollection.get = mockGet;
  mockCollection.where = jest.fn(() => mockCollection);
  mockCollection.orderBy = jest.fn(() => mockCollection);
  mockCollection.limit = jest.fn(() => mockCollection);
  mockCollection.add = jest.fn(() => Promise.resolve({ id: 'mock-id' }));
  
  mockDoc.get = mockGet;
  mockDoc.set = jest.fn(() => Promise.resolve());
  mockDoc.update = jest.fn(() => Promise.resolve());
  mockDoc.delete = jest.fn(() => Promise.resolve());
  mockDoc.collection = mockCollection;
  
  return {
    __esModule: true,
    default: jest.fn(() => ({
      collection: mockCollection,
      doc: mockDoc,
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn(() => Promise.resolve()),
      })),
      settings: jest.fn(),
    })),
    Timestamp: {
      now: jest.fn(() => ({ toDate: () => new Date() })),
      fromDate: jest.fn((date) => ({ toDate: () => date })),
    },
    FieldValue: {
      serverTimestamp: jest.fn(() => new Date()),
      arrayUnion: jest.fn((...values) => ({ __op: 'arrayUnion', values })),
      arrayRemove: jest.fn((...values) => ({ __op: 'arrayRemove', values })),
      increment: jest.fn((n = 1) => ({ __op: 'increment', by: n })),
      delete: jest.fn(() => ({ __op: 'delete' })),
    },
  };
});

jest.mock('@react-native-firebase/storage', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    ref: jest.fn(() => ({
      putFile: jest.fn(() => Promise.resolve()),
      getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/file.jpg')),
      delete: jest.fn(() => Promise.resolve()),
    })),
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Use real @testing-library/react-native: do not mock render utilities

// Mock Expo Notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
  scheduleNotificationAsync: jest.fn(),
}));

// Patch Modal on react-native (Modal is undefined in node test environment)
const React = require('react');
const RN = require('react-native');
if (!RN.Modal || typeof RN.Modal !== 'function') {
  RN.Modal = ({ visible, children, ...props }) => {
    if (!visible) return null;
    return React.createElement('View', { ...props, testID: 'modal' }, children);
  };
  RN.Modal.displayName = 'MockModal';
}

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children, ...props }) => React.createElement('View', props, children),
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 375, height: 812 }),
  };
});

// Mock RevenueCat (react-native-purchases) to avoid ESM transform issues in Jest
jest.mock('react-native-purchases', () => {
  const api = {
    configure: jest.fn(),
    setAttributes: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} }, activeSubscriptions: [], allExpirationDates: {} }),
    getOfferings: jest.fn().mockResolvedValue({ current: { availablePackages: [] } }),
    purchasePackage: jest.fn().mockResolvedValue({ customerInfo: {} }),
    restorePurchases: jest.fn().mockResolvedValue({}),
    logOut: jest.fn(),
  };
  const mod = api;
  return { __esModule: true, default: mod, ...api };
});

// Suppress console output during tests (but keep errors for debugging)
const originalError = console.error;
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn((...args) => {
    // Only suppress specific Firebase mock errors
    if (typeof args[0] === 'string' && args[0].includes('Firebase')) {
      return;
    }
    originalError(...args);
  }),
};

