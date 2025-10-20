/**
 * Household Context
 * Manages current household state and provides household-related functionality
 */

import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {householdService} from '@/services/household.service';
import { subscriptionService } from '@/services/subscription.service';
import {Household} from '@/types';
import {useAuth} from './AuthContext';

interface HouseholdContextType {
  currentHousehold: Household | null;
  households: Household[]  ;
  loading: boolean;
  error: string | null;
  setCurrentHousehold: (household: Household | null) => void;
  refreshHouseholds: () => Promise<void>;
  createHousehold: (name: string, settings?: any) => Promise<Household>;
  joinHousehold: (joinCode: string) => Promise<Household>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

interface HouseholdProviderProps {
  children: ReactNode;
}

export const HouseholdProvider: React.FC<HouseholdProviderProps> = ({children}) => {
  const {user} = useAuth();
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHouseholds = React.useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const userHouseholds = await householdService.getUserHouseholds(user.id);
      setHouseholds(userHouseholds);

      // Auto-select first household if none selected
      setCurrentHousehold((current) => {
        if (!current && userHouseholds.length > 0) {
          return userHouseholds[0];
        }

        // If current household is no longer in list, clear it
        if (current && !userHouseholds.find(h => h.id === current.id)) {
          return userHouseholds[0] || null;
        }

        return current;
      });
    } catch (err) {
      console.error('Failed to load households:', err);
      setError('Failed to load households');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load user's households on mount and when user changes
  useEffect(() => {
    if (user) {
      loadHouseholds();
    } else {
      setHouseholds([]);
      setCurrentHousehold(null);
      setLoading(false);
    }
  }, [user, loadHouseholds]);

  const refreshHouseholds = async () => {
    await loadHouseholds();
  };

  const createHousehold = async (name: string, settings?: any): Promise<Household> => {
    if (!user) {
      throw new Error('Must be logged in to create household');
    }

    // Enforce subscription tier: check if user can add a household
    const limitCheck = await subscriptionService.canAddHousehold(user.id);
    if (!limitCheck.allowed) {
      const msg = limitCheck.reason || 'Your subscription does not allow creating another household';
      throw new Error(msg);
    }

    const household = await householdService.createHousehold(name, user.id, settings);
    await refreshHouseholds();
    setCurrentHousehold(household);
    return household;
  };

  const joinHousehold = async (joinCode: string): Promise<Household> => {
    if (!user) {
      throw new Error('Must be logged in to join household');
    }

    const household = await householdService.joinHouseholdByCode(joinCode, user.id);
    await refreshHouseholds();
    setCurrentHousehold(household);
    return household;
  };

  const value: HouseholdContextType = {
    currentHousehold,
    households,
    loading,
    error,
    setCurrentHousehold,
    refreshHouseholds,
    createHousehold,
    joinHousehold,
  };

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
};

/**
 * Hook to access household context
 * @throws Error if used outside HouseholdProvider
 */
export const useHousehold = (): HouseholdContextType => {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};

/**
 * Hook to get current household ID (convenience)
 * Returns null if no household selected
 */
export const useCurrentHouseholdId = (): string | null => {
  const {currentHousehold} = useHousehold();
  return currentHousehold?.id || null;
};
