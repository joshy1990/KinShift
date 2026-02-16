/**
 * useHouseholdMembers - Hook for loading and managing household member data
 * Reusable logic for fetching household members across components
 */

import { useState, useEffect, useCallback } from 'react';
import { HouseholdMember } from '@/types';
import { householdService } from '@/services/household.service';
import { ServiceError } from '@/services/base.service';

export interface UseHouseholdMembersResult {
  members: HouseholdMember[];
  usersMap: Record<string, { name: string; email: string }>;
  loading: boolean;
  error: ServiceError | null;
  refresh: () => Promise<void>;
}

export function useHouseholdMembers(
  householdId: string | null
): UseHouseholdMembersResult {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, { name: string; email: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  const loadMembers = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const householdMembers = await householdService.getHouseholdMembers(householdId);
      setMembers(householdMembers);

      // Create users map for quick lookups
      const newUsersMap: Record<string, { name: string; email: string }> = {};
      householdMembers.forEach((member) => {
        newUsersMap[member.userId] = {
          name: member.name || `${member.email?.split('@')[0] || 'Unknown'}`,
          email: member.email || '',
        };
      });
      setUsersMap(newUsersMap);
      
      setLoading(false);
    } catch (err: any) {
      const serviceError: ServiceError = {
        code: err.code || 'load-members-error',
        message: err.message || 'Failed to load household members',
        details: err,
      };
      setError(serviceError);
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    loadMembers();
  }, [householdId, loadMembers]);

  return {
    members,
    usersMap,
    loading,
    error,
    refresh: loadMembers,
  };
}
