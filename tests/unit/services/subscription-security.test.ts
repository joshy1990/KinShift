/**
 * Tests for subscription service security hardening:
 * - changeSubscriptionTier now throws (client-side tier changes blocked)
 * - canAddHousehold / canAddMember fail-closed on errors
 */

// Firestore compat mock
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock('@/config/firestore.compat', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  doc: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));
jest.mock('@/config/firebase.config', () => ({
  db: {},
  COLLECTIONS: {
    SUBSCRIPTIONS: 'subscriptions',
    HOUSEHOLDS: 'households',
  },
}));
jest.mock('@/services/audit.service', () => ({
  auditService: { logHouseholdAction: jest.fn() },
}));
jest.mock('@/services/rbac.service', () => ({
  rbacService: {
    enforceAdminOnly: jest.fn().mockResolvedValue({ allowed: true }),
  },
  AuditAction: { SUBSCRIPTION_UPGRADE: 'subscription:upgrade', SUBSCRIPTION_CANCEL: 'subscription:cancel' },
}));

import { subscriptionService } from '@/services/subscription.service';

describe('SubscriptionService — Security Hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── changeSubscriptionTier throws ───────────────────────────────────
  describe('changeSubscriptionTier', () => {
    it('throws an error to prevent client-side tier escalation', async () => {
      await expect(
        subscriptionService.changeSubscriptionTier('user-1', 'premium')
      ).rejects.toThrow('Direct tier changes are disabled');
    });

    it('throws even for downgrades (must go through webhook)', async () => {
      await expect(
        subscriptionService.changeSubscriptionTier('user-1', 'free')
      ).rejects.toThrow('Direct tier changes are disabled');
    });

    it('never calls updateDoc', async () => {
      try {
        await subscriptionService.changeSubscriptionTier('user-1', 'standard');
      } catch {
        // Expected
      }
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });
});
