/**
 * Unit tests for AuthService
 */

import auth from '@react-native-firebase/auth';

// Mock firestore compat
jest.mock('@/config/firestore.compat', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('@/config/firebase.config', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn().mockResolvedValue(undefined),
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
      })),
    })),
  },
  COLLECTIONS: {
    USERS: 'users',
    HOUSEHOLDS: 'households',
    SHIFTS: 'shifts',
    DAY_NOTES: 'dayNotes',
    NOTIFICATIONS: 'notifications',
    SUBSCRIPTIONS: 'subscriptions',
    INVITATIONS: 'invitations',
  },
}));

jest.mock('@/services/household.service', () => ({
  householdService: {
    getHousehold: jest.fn(),
    handleAdminPromotionAndDowngrade: jest.fn(),
  },
}));

import { authService } from '@/services/auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('returns null when no user is signed in', () => {
      (auth as unknown as jest.Mock).mockReturnValue({
        currentUser: null,
      });
      const result = authService.getCurrentUser();
      expect(result).toBeNull();
    });

    it('returns user object when signed in', () => {
      (auth as unknown as jest.Mock).mockReturnValue({
        currentUser: {
          uid: 'u1',
          displayName: 'Test User',
          email: 'test@example.com',
          photoURL: 'https://example.com/photo.jpg',
          metadata: { creationTime: '2026-01-01' },
        },
      });
      const result = authService.getCurrentUser();
      expect(result).not.toBeNull();
      expect(result!.id).toBe('u1');
      expect(result!.name).toBe('Test User');
      expect(result!.email).toBe('test@example.com');
    });

    it('handles missing displayName', () => {
      (auth as unknown as jest.Mock).mockReturnValue({
        currentUser: {
          uid: 'u2',
          displayName: null,
          email: 'noname@example.com',
          photoURL: null,
          metadata: {},
        },
      });
      const result = authService.getCurrentUser();
      expect(result!.name).toBe('');
    });
  });

  describe('signOut', () => {
    it('calls auth signOut', async () => {
      const signOutMock = jest.fn().mockResolvedValue(undefined);
      (auth as unknown as jest.Mock).mockReturnValue({
        signOut: signOutMock,
      });
      await authService.signOut();
      expect(signOutMock).toHaveBeenCalled();
    });

    it('throws on signOut failure', async () => {
      (auth as unknown as jest.Mock).mockReturnValue({
        signOut: jest.fn().mockRejectedValue(new Error('fail')),
      });
      await expect(authService.signOut()).rejects.toThrow('Failed to sign out');
    });
  });

  describe('resetPassword', () => {
    it('sends password reset email', async () => {
      const sendResetMock = jest.fn().mockResolvedValue(undefined);
      (auth as unknown as jest.Mock).mockReturnValue({
        sendPasswordResetEmail: sendResetMock,
      });
      await authService.resetPassword('test@example.com');
      expect(sendResetMock).toHaveBeenCalledWith('test@example.com');
    });

    it('handles email-not-found error', async () => {
      (auth as unknown as jest.Mock).mockReturnValue({
        sendPasswordResetEmail: jest.fn().mockRejectedValue({
          code: 'auth/user-not-found',
          message: 'not found',
        }),
      });
      await expect(authService.resetPassword('nonexistent@example.com'))
        .rejects.toThrow('No account found with this email');
    });
  });

  describe('handleAuthError (via signIn)', () => {
    const setupAuthError = (code: string) => {
      (auth as unknown as jest.Mock).mockReturnValue({
        signInWithEmailAndPassword: jest.fn().mockRejectedValue({ code, message: code }),
      });
    };

    it('maps auth/email-already-in-use', async () => {
      setupAuthError('auth/email-already-in-use');
      await expect(authService.signInWithEmail('a@b.c', 'pass'))
        .rejects.toThrow('This email is already registered');
    });

    it('maps auth/weak-password', async () => {
      setupAuthError('auth/weak-password');
      await expect(authService.signInWithEmail('a@b.c', '1'))
        .rejects.toThrow('Password must be at least 6 characters');
    });

    it('maps auth/too-many-requests', async () => {
      setupAuthError('auth/too-many-requests');
      await expect(authService.signInWithEmail('a@b.c', 'pass'))
        .rejects.toThrow('Too many attempts');
    });

    it('maps auth/invalid-credential', async () => {
      setupAuthError('auth/invalid-credential');
      await expect(authService.signInWithEmail('a@b.c', 'pass'))
        .rejects.toThrow('Invalid email or password');
    });

    it('maps network errors from message', async () => {
      (auth as unknown as jest.Mock).mockReturnValue({
        signInWithEmailAndPassword: jest.fn().mockRejectedValue({
          code: 'auth/unknown',
          message: 'Network error',
        }),
      });
      await expect(authService.signInWithEmail('a@b.c', 'pass'))
        .rejects.toThrow('Network connection failed');
    });
  });

  describe('onAuthStateChanged', () => {
    it('registers listener', () => {
      const mockUnsubscribe = jest.fn();
      (auth as unknown as jest.Mock).mockReturnValue({
        onAuthStateChanged: jest.fn(() => mockUnsubscribe),
      });
      const cb = jest.fn();
      const unsub = authService.onAuthStateChanged(cb);
      expect(typeof unsub).toBe('function');
    });
  });
});
