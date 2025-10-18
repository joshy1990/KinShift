/**
 * Household Context
 * Manages current household state and provides household-related functionality
 */

import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {householdService} from '@/services/household.service';
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

  // Load user's households on mount and when user changes
  useEffect(() => {
    if (user) {
      loadHouseholds();
    } else {
      setHouseholds([]);
      setCurrentHousehold(null);
      setLoading(false);
    }
  }, [user]);

  const loadHouseholds = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const userHouseholds = await householdService.getUserHouseholds(user.id);
      setHouseholds(userHouseholds);

      // Auto-select first household if none selected
      if (!currentHousehold && userHouseholds.length > 0) {
        setCurrentHousehold(userHouseholds[0]);
      }

      // If current household is no longer in list, clear it
      if (currentHousehold && !userHouseholds.find(h => h.id === currentHousehold.id)) {
        setCurrentHousehold(userHouseholds[0] || null);
      }
    } catch (err) {
      console.error('Failed to load households:', err);
      setError('Failed to load households');
    } finally {
      setLoading(false);
    }
  };

  const refreshHouseholds = async () => {
    await loadHouseholds();
  };

  const createHousehold = async (name: string, settings?: any): Promise<Household> => {
    if (!user) {
      throw new Error('Must be logged in to create household');
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
