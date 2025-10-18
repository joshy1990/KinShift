/**
 * AuthContext Tests
 * Tests for authentication context functionality including sign in, sign up, sign out, and user state
 */

import React from 'react';
import {render, waitFor, act} from '@testing-library/react-native';
import {AuthProvider, useAuth} from '../AuthContext';
import {authService} from '@/services/auth.service';
import {notificationService} from '@/services/notification.service';
import {User} from '@/types';
import {Text, View, Platform} from 'react-native';

// Mock the auth service
jest.mock('@/services/auth.service');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock notification service
jest.mock('@/services/notification.service');
const mockNotificationService = notificationService as jest.Mocked<
  typeof notificationService
>;

// Test component that uses the auth context
const TestComponent: React.FC = () => {
  const {user, loading, signIn, signUp, signOut, updateUserProfile} = useAuth();

  return (
    <View>
      <Text testID="loading">{loading ? 'true' : 'false'}</Text>
      <Text testID="user-id">{user?.id || 'null'}</Text>
      <Text testID="user-email">{user?.email || 'null'}</Text>
      <Text testID="user-name">{user?.name || 'null'}</Text>
    </View>
  );
};

describe('AuthContext', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let authStateCallback: ((user: User | null) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;

    // Mock onAuthStateChanged to capture the callback
    mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
      authStateCallback = callback;
      // Start with no user
      callback(null);
      return jest.fn(); // unsubscribe function
    });

    // Mock notification service
    mockNotificationService.initialize.mockResolvedValue(undefined);
    mockNotificationService.cleanup.mockReturnValue(undefined);
  });

  describe('Initial State', () => {
    it('should initialize with no user and loading=false after auth check', async () => {
      const {getByTestId} = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Should eventually finish loading
      await waitFor(() => {
        expect(getByTestId('loading').children[0]).toBe('false');
      });

      expect(getByTestId('user-id').children[0]).toBe('null');
      expect(mockAuthService.onAuthStateChanged).toHaveBeenCalled();
    });

    it('should set user if already authenticated', async () => {
      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      const {getByTestId} = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(getByTestId('loading').children[0]).toBe('false');
      });

      expect(getByTestId('user-id').children[0]).toBe('test-user-id');
      expect(getByTestId('user-email').children[0]).toBe('test@example.com');
      expect(getByTestId('user-name').children[0]).toBe('Test User');
    });

    it('should initialize push notifications when user logs in (non-web)', async () => {
      Platform.OS = 'ios';

      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockNotificationService.initialize).toHaveBeenCalledWith(
          'test-user-id'
        );
      });
    });

    it('should not initialize push notifications on web', async () => {
      Platform.OS = 'web';

      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockNotificationService.initialize).not.toHaveBeenCalled();
      });
    });
  });

  describe('signIn', () => {
    it('should sign in user with email and password', async () => {
      mockAuthService.signInWithEmail.mockResolvedValue(mockUser);

      let signInFn: any;

      const SignInTestComponent: React.FC = () => {
        const {user, signIn} = useAuth();
        signInFn = signIn;

        return (
          <View>
            <Text testID="user-id">{user?.id || 'null'}</Text>
            <Text testID="user-email">{user?.email || 'null'}</Text>
          </View>
        );
      };

      const {getByTestId} = render(
        <AuthProvider>
          <SignInTestComponent />
        </AuthProvider>
      );

      // Wait for initial auth check
      await waitFor(() => {
        expect(getByTestId('user-id').children[0]).toBe('null');
      });

      // Sign in
      await act(async () => {
        await signInFn('test@example.com', 'password123');
      });

      // Should have called signInWithEmail
      expect(mockAuthService.signInWithEmail).toHaveBeenCalledWith(
        'test@example.com',
        'password123'
      );

      // Should update user state
      await waitFor(() => {
        expect(getByTestId('user-id').children[0]).toBe('test-user-id');
        expect(getByTestId('user-email').children[0]).toBe('test@example.com');
      });
    });

    it('should throw error on invalid credentials', async () => {
      mockAuthService.signInWithEmail.mockRejectedValue(
        new Error('Invalid email or password')
      );

      let signInFn: any;
      let error: any = null;

      const SignInTestComponent: React.FC = () => {
        const {signIn} = useAuth();
        signInFn = signIn;
        return <View />;
      };

      render(
        <AuthProvider>
          <SignInTestComponent />
        </AuthProvider>
      );

      // Try to sign in with invalid credentials
      try {
        await act(async () => {
          await signInFn('wrong@example.com', 'wrongpassword');
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Invalid email or password');
    });

    it('should handle network errors gracefully', async () => {
      mockAuthService.signInWithEmail.mockRejectedValue(
        new Error('Network request failed')
      );

      let signInFn: any;
      let error: any = null;

      const SignInTestComponent: React.FC = () => {
        const {signIn} = useAuth();
        signInFn = signIn;
        return <View />;
      };

      render(
        <AuthProvider>
          <SignInTestComponent />
        </AuthProvider>
      );

      try {
        await act(async () => {
          await signInFn('test@example.com', 'password');
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Network request failed');
    });
  });

  describe('signUp', () => {
    it('should sign up new user with email, password, and name', async () => {
      const newUser: User = {
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.signUpWithEmail.mockResolvedValue(newUser);

      let signUpFn: any;

      const SignUpTestComponent: React.FC = () => {
        const {user, signUp} = useAuth();
        signUpFn = signUp;

        return (
          <View>
            <Text testID="user-id">{user?.id || 'null'}</Text>
            <Text testID="user-name">{user?.name || 'null'}</Text>
          </View>
        );
      };

      const {getByTestId} = render(
        <AuthProvider>
          <SignUpTestComponent />
        </AuthProvider>
      );

      // Wait for initial state
      await waitFor(() => {
        expect(getByTestId('user-id').children[0]).toBe('null');
      });

      // Sign up
      await act(async () => {
        await signUpFn('newuser@example.com', 'password123', 'New User');
      });

      // Should have called signUpWithEmail
      expect(mockAuthService.signUpWithEmail).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123',
        'New User'
      );

      // Should update user state
      await waitFor(() => {
        expect(getByTestId('user-id').children[0]).toBe('new-user-id');
        expect(getByTestId('user-name').children[0]).toBe('New User');
      });
    });

    it('should throw error when email already exists', async () => {
      mockAuthService.signUpWithEmail.mockRejectedValue(
        new Error('Email already in use')
      );

      let signUpFn: any;
      let error: any = null;

      const SignUpTestComponent: React.FC = () => {
        const {signUp} = useAuth();
        signUpFn = signUp;
        return <View />;
      };

      render(
        <AuthProvider>
          <SignUpTestComponent />
        </AuthProvider>
      );

      try {
        await act(async () => {
          await signUpFn('existing@example.com', 'password', 'User');
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Email already in use');
    });

    it('should throw error when password is too weak', async () => {
      mockAuthService.signUpWithEmail.mockRejectedValue(
        new Error('Password should be at least 6 characters')
      );

      let signUpFn: any;
      let error: any = null;

      const SignUpTestComponent: React.FC = () => {
        const {signUp} = useAuth();
        signUpFn = signUp;
        return <View />;
      };

      render(
        <AuthProvider>
          <SignUpTestComponent />
        </AuthProvider>
      );

      try {
        await act(async () => {
          await signUpFn('test@example.com', '123', 'User');
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Password should be at least 6 characters');
    });
  });

  describe('signOut', () => {
    it('should sign out user and clear state', async () => {
      // Start with authenticated user
      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      mockAuthService.signOut.mockResolvedValue(undefined);

      let signOutFn: any;

      const SignOutTestComponent: React.FC = () => {
        const {user, signOut} = useAuth();
        signOutFn = signOut;

        return (
          <View>
            <Text testID="user-id">{user?.id || 'null'}</Text>
          </View>
        );
      };

      const {getByTestId} = render(
        <AuthProvider>
          <SignOutTestComponent />
        </AuthProvider>
      );

      // Should have user initially
      await waitFor(() => {
        expect(getByTestId('user-id').children[0]).toBe('test-user-id');
      });

      // Sign out
      await act(async () => {
        await signOutFn();
      });

      // Should have called signOut service
      expect(mockAuthService.signOut).toHaveBeenCalled();

      // Should clear user state
      await waitFor(() => {
        expect(getByTestId('user-id').children[0]).toBe('null');
      });
    });

    it('should cleanup notifications on sign out (non-web)', async () => {
      Platform.OS = 'ios';

      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      mockAuthService.signOut.mockResolvedValue(undefined);

      let signOutFn: any;

      const SignOutTestComponent: React.FC = () => {
        const {signOut} = useAuth();
        signOutFn = signOut;
        return <View />;
      };

      render(
        <AuthProvider>
          <SignOutTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(mockNotificationService.initialize).toHaveBeenCalled();
      });

      // Sign out
      await act(async () => {
        await signOutFn();
      });

      // Should cleanup notifications
      expect(mockNotificationService.cleanup).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      mockAuthService.signOut.mockRejectedValue(
        new Error('Sign out failed')
      );

      let signOutFn: any;
      let error: any = null;

      const SignOutTestComponent: React.FC = () => {
        const {signOut} = useAuth();
        signOutFn = signOut;
        return <View />;
      };

      render(
        <AuthProvider>
          <SignOutTestComponent />
        </AuthProvider>
      );

      try {
        await act(async () => {
          await signOutFn();
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Sign out failed');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile', async () => {
      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      mockAuthService.updateProfile.mockResolvedValue(undefined);

      let updateUserProfileFn: any;

      const UpdateTestComponent: React.FC = () => {
        const {user, updateUserProfile} = useAuth();
        updateUserProfileFn = updateUserProfile;

        return (
          <View>
            <Text testID="user-name">{user?.name || 'null'}</Text>
          </View>
        );
      };

      const {getByTestId} = render(
        <AuthProvider>
          <UpdateTestComponent />
        </AuthProvider>
      );

      // Wait for initial user
      await waitFor(() => {
        expect(getByTestId('user-name').children[0]).toBe('Test User');
      });

      // Update profile
      await act(async () => {
        await updateUserProfileFn({name: 'Updated Name'});
      });

      // Should have called updateProfile service
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('test-user-id', {
        name: 'Updated Name',
      });

      // Should update user state
      await waitFor(() => {
        expect(getByTestId('user-name').children[0]).toBe('Updated Name');
      });
    });

    it('should throw error when no user is logged in', async () => {
      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(null);
        return jest.fn();
      });

      let updateUserProfileFn: any;
      let error: any = null;

      const UpdateTestComponent: React.FC = () => {
        const {updateUserProfile} = useAuth();
        updateUserProfileFn = updateUserProfile;
        return <View />;
      };

      render(
        <AuthProvider>
          <UpdateTestComponent />
        </AuthProvider>
      );

      try {
        await act(async () => {
          await updateUserProfileFn({name: 'New Name'});
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('No user logged in');
    });

    it('should handle update errors', async () => {
      mockAuthService.onAuthStateChanged.mockImplementation((callback) => {
        callback(mockUser);
        return jest.fn();
      });

      mockAuthService.updateProfile.mockRejectedValue(
        new Error('Update failed')
      );

      let updateUserProfileFn: any;
      let error: any = null;

      const UpdateTestComponent: React.FC = () => {
        const {updateUserProfile} = useAuth();
        updateUserProfileFn = updateUserProfile;
        return <View />;
      };

      render(
        <AuthProvider>
          <UpdateTestComponent />
        </AuthProvider>
      );

      try {
        await act(async () => {
          await updateUserProfileFn({name: 'New Name'});
        });
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.message).toBe('Update failed');
    });
  });

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const consoleError = console.error;
      console.error = jest.fn();

      expect(() => {
        const TestComponent = () => {
          useAuth();
          return <View />;
        };
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = consoleError;
    });
  });
});
