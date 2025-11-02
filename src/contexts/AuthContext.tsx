import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {Platform} from 'react-native';
import {User} from '@/types';
import {authService} from '@/services/auth.service';
import {notificationService} from '@/services/notification.service';
import {revenueCatService} from '@/services/revenueCat.service';
import {useNotificationSetup} from '@/utils/notificationIntegration';
import {setSentryUser, clearSentryUser} from '@/config/sentry.config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state listener
  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = authService.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setLoading(false);
      
      // Set Sentry user context
      if (currentUser) {
        setSentryUser(currentUser.id, currentUser.email, currentUser.name);
      } else {
        clearSentryUser();
      }
    });

    return unsubscribe;
  }, []);

  // Setup notifications when user is authenticated
  useNotificationSetup(user?.id && Platform.OS !== 'web' ? user.id : null);

  // Initialize RevenueCat when user logs in
  useEffect(() => {
    if (user && Platform.OS !== 'web') {
      revenueCatService.initialize(user.id).catch(error => {
        console.error('Failed to initialize RevenueCat:', error);
      });
    } else if (!user && Platform.OS !== 'web') {
      // Cleanup is not needed here as services use Firebase auth state
      revenueCatService.logout();
    }

    return () => {
      // Cleanup on unmount
      if (!user && Platform.OS !== 'web') {
        revenueCatService.logout();
      }
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const userData = await authService.signInWithEmail(email, password);
    setUser(userData);
  };

  const signUp = async (email: string, password: string, name: string) => {
    const userData = await authService.signUpWithEmail(email, password, name);
    setUser(userData);
  };

  const signOut = async () => {
    await authService.signOut();
    if (Platform.OS !== 'web' && user?.id) {
      try { 
        await notificationService.cleanup(user.id); 
      } catch (error) {
        console.error('Error cleaning up notifications:', error);
      }
    }
    
    // Clear Sentry user context
    clearSentryUser();
    
    setUser(null);
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user) {
      throw new Error('No user logged in');
    }
    await authService.updateProfile(user.id, updates);
    setUser({...user, ...updates});
  };

  const deleteAccount = async (password: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }
    await authService.deleteAccount(password);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
