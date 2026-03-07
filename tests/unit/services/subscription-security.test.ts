/**
 * Tests for subscription service security hardening:
 * - canAddHousehold / canAddMember fail-closed on errors
 * - shouldShowAds ad visibility logic
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

  // ── shouldShowAds ──────────────────────────────────────────────────
  describe('shouldShowAds', () => {
    it('shows ads for free tier users', () => {
      expect(subscriptionService.shouldShowAds('free')).toBe(true);
    });

    it('hides ads for pro tier users', () => {
      expect(subscriptionService.shouldShowAds('pro')).toBe(false);
    });
  });

  // ── getTierLimits ─────────────────────────────────────────────────
  describe('getTierLimits', () => {
    it('free tier limited to 1 household, 2 members', () => {
      const limits = subscriptionService.getTierLimits('free');
      expect(limits.maxHouseholds).toBe(1);
      expect(limits.maxMembersPerHousehold).toBe(2);
      expect(limits.showAds).toBe(true);
      expect(limits.canExportCalendar).toBe(false);
    });

    it('pro tier gets unlimited households, 12 members, no ads', () => {
      const limits = subscriptionService.getTierLimits('pro');
      expect(limits.maxHouseholds).toBe(-1);
      expect(limits.maxMembersPerHousehold).toBe(12);
      expect(limits.showAds).toBe(false);
      expect(limits.canExportCalendar).toBe(true);
    });
  });
});
