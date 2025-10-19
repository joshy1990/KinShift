import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {Platform} from 'react-native';
import {User} from '@/types';
import {authService} from '@/services/auth.service';
import {notificationService} from '@/services/notification.service';
import {revenueCatService} from '@/services/revenueCat.service';

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

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = authService.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Initialize push notifications and RevenueCat when user logs in
  useEffect(() => {
    if (user && Platform.OS !== 'web') {
      notificationService.initialize(user.id).catch(error => {
        console.error('Failed to initialize push notifications:', error);
      });
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
    try {
      const userData = await authService.signInWithEmail(email, password);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userData = await authService.signUpWithEmail(email, password, name);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  const updateUserProfile = async (updates: Partial<User>) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      await authService.updateProfile(user.id, updates);
      setUser({...user, ...updates});
    } catch (error) {
      throw error;
    }
  };

  const deleteAccount = async (password: string) => {
    if (!user) {
      throw new Error('No user logged in');
    }

    try {
      await authService.deleteAccount(password);
      setUser(null);
    } catch (error) {
      throw error;
    }
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
