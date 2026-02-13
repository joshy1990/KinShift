import { useState, useEffect, useCallback } from 'react';
import { HouseholdMember } from '@/types';
import { householdService } from '@/services/household.service';
import { ServiceError } from '@/services/base.service';

export interface UseHouseholdMembersOptions {
  householdId: string | undefined;
  /** Whether to fetch automatically (default: true) */
  enabled?: boolean;
}

export interface UseHouseholdMembersResult {
  members: HouseholdMember[];
  loading: boolean;
  error: ServiceError | null;
  refresh: () => Promise<void>;
  getMemberById: (userId: string) => HouseholdMember | undefined;
}

/**
 * Hook for loading and managing household member data.
 * Fetches member profiles with their roles from the household service.
 */
export function useHouseholdMembers(
  options: UseHouseholdMembersOptions
): UseHouseholdMembersResult {
  const { householdId, enabled = true } = options;
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!householdId || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await householdService.getHouseholdMembers(householdId);
      setMembers(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load members';
      setError({
        code: 'members-fetch-error',
        message,
      } as ServiceError);
    } finally {
      setLoading(false);
    }
  }, [householdId, enabled]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const getMemberById = useCallback(
    (userId: string) => members.find((m) => m.userId === userId),
    [members]
  );

  return {
    members,
    loading,
    error,
    refresh: fetchMembers,
    getMemberById,
  };
}
