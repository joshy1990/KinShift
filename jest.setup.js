// Jest setup file for tests
// Mock Firebase for testing

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApp: jest.fn(() => ({})),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  initializeFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  onSnapshot: jest.fn(),
  setDoc: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: jest.fn(),
}));

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

// Mock Testing Library
jest.mock('@testing-library/react-native', () => ({
  render: jest.fn(),
  waitFor: jest.fn(),
  act: jest.fn(),
  fireEvent: jest.fn(),
  screen: {
    getByText: jest.fn(),
    getByTestId: jest.fn(),
    findByText: jest.fn(),
  },
}));

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

