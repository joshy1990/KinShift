// Jest setup file for tests
// Mock Firebase for testing

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => {
  const defaultSnapshot = { docs: [], empty: true, forEach: jest.fn(), size: 0 };
  return {
    getFirestore: jest.fn(),
    initializeFirestore: jest.fn(),
    collection: jest.fn((...args) => ({ __type: 'collection', args })),
    doc: jest.fn((...args) => ({ __type: 'doc', args })),
    query: jest.fn((...args) => ({ __type: 'query', args })),
    orderBy: jest.fn((..._args) => ({ __type: 'orderBy' })),
    limit: jest.fn((..._args) => ({ __type: 'limit' })),
    startAfter: jest.fn((..._args) => ({ __type: 'startAfter' })),
    endBefore: jest.fn((..._args) => ({ __type: 'endBefore' })),
    startAt: jest.fn((..._args) => ({ __type: 'startAt' })),
    where: jest.fn((..._args) => ({ __type: 'where' })),
    getDocs: jest.fn(async () => defaultSnapshot),
    getDoc: jest.fn(async () => ({ exists: () => true, id: 'mock-id', data: () => ({}) })),
    addDoc: jest.fn(async () => ({ id: 'mock-id' })),
    updateDoc: jest.fn(async () => undefined),
    deleteDoc: jest.fn(async () => undefined),
    serverTimestamp: jest.fn(() => new Date()),
    onSnapshot: jest.fn((...args) => {
      const success = args.find((a) => typeof a === 'function');
      // schedule on next tick to work with tests using done()
      if (success) {
        setTimeout(() => {
          try { success(defaultSnapshot); } catch (_e) {}
        }, 0);
      }
      return jest.fn(); // unsubscribe
    }),
    setDoc: jest.fn(async () => undefined),
    writeBatch: jest.fn(() => ({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn(async () => undefined),
    })),
    Timestamp: jest.fn(() => ({ toDate: () => new Date() })),
    arrayUnion: jest.fn((...values) => ({ __op: 'arrayUnion', values })),
    arrayRemove: jest.fn((...values) => ({ __op: 'arrayRemove', values })),
    increment: jest.fn((n = 1) => ({ __op: 'increment', by: n })),
  };
});

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
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

