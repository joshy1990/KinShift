/**
 * Integration tests — RBAC & Audit enforcement
 *
 * Tests that the RBAC service correctly delegates to audit logging
 * and returns structured RBACResult objects matching the expected contract.
 */

jest.mock('@/config/firestore.compat', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('@/config/firebase.config', () => ({
  db: {},
}));

jest.mock('@/services/audit.service', () => ({
  auditService: {
    logHouseholdAction: jest.fn().mockResolvedValue(undefined),
  },
}));

import { getDoc } from '@/config/firestore.compat';
import { rbacService, AuditAction } from '@/services/rbac.service';
import { auditService } from '@/services/audit.service';

const mockHousehold = (admins: string[], members: string[]) => ({
  exists: () => true,
  data: () => ({ admins, members }),
});

describe('RBAC + Audit Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rbacService.clearCache();
  });

  describe('unauthorized actions are audit-logged', () => {
    it('logs when non-admin tries admin-only action', async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1'], ['user-1']));

      const result = await rbacService.enforceAdminOnly('h1', 'user-1', AuditAction.SETTINGS_UPDATE);

      expect(result.allowed).toBe(false);
      expect(auditService.logHouseholdAction).toHaveBeenCalledWith(
        'h1',
        'user-1',
        AuditAction.SETTINGS_UPDATE,
        expect.objectContaining({ success: false }),
      );
    });

    it('logs when non-member tries member-only action', async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1'], ['member-1']));

      const result = await rbacService.enforceMemberOnly('h1', 'outsider', AuditAction.SHIFT_CREATE);

      expect(result.allowed).toBe(false);
      expect(auditService.logHouseholdAction).toHaveBeenCalledWith(
        'h1',
        'outsider',
        AuditAction.SHIFT_CREATE,
        expect.objectContaining({ success: false }),
      );
    });

    it('logs when non-owner, non-admin edits resource', async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1'], ['user-1', 'user-2']));

      const result = await rbacService.enforceAdminOrOwner('h1', 'user-2', 'user-1', AuditAction.DAYNOTE_DELETE);

      expect(result.allowed).toBe(false);
      expect(auditService.logHouseholdAction).toHaveBeenCalledWith(
        'h1',
        'user-2',
        AuditAction.DAYNOTE_DELETE,
        expect.objectContaining({ ownerId: 'user-1' }),
      );
    });

    it('logs when trying to remove last admin', async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1'], ['member-1']));

      const result = await rbacService.enforceNotLastAdmin('h1', 'admin-1', AuditAction.MEMBER_DEMOTE, 'admin-1');

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('INVALID_STATE');
      expect(auditService.logHouseholdAction).toHaveBeenCalledWith(
        'h1',
        'admin-1',
        AuditAction.MEMBER_DEMOTE,
        expect.objectContaining({ reason: 'Cannot remove last admin' }),
      );
    });
  });

  describe('authorized actions are NOT audit-logged', () => {
    it('admin performing admin action logs nothing', async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1'], []));

      const result = await rbacService.enforceAdminOnly('h1', 'admin-1', AuditAction.SETTINGS_UPDATE);

      expect(result.allowed).toBe(true);
      expect(auditService.logHouseholdAction).not.toHaveBeenCalled();
    });

    it('member performing member action logs nothing', async () => {
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold([], ['user-1']));

      const result = await rbacService.enforceMemberOnly('h1', 'user-1', AuditAction.SHIFT_CREATE);

      expect(result.allowed).toBe(true);
      expect(auditService.logHouseholdAction).not.toHaveBeenCalled();
    });
  });

  describe('RBACResult → HTTP mapping', () => {
    it('maps all codes correctly', () => {
      expect(rbacService.getHTTPStatus({ allowed: false, code: 'FORBIDDEN' })).toBe(403);
      expect(rbacService.getHTTPStatus({ allowed: false, code: 'UNAUTHORIZED' })).toBe(401);
      expect(rbacService.getHTTPStatus({ allowed: false, code: 'NOT_FOUND' })).toBe(404);
      expect(rbacService.getHTTPStatus({ allowed: false, code: 'INVALID_STATE' })).toBe(400);
      expect(rbacService.getHTTPStatus({ allowed: false })).toBe(403);
    });
  });

  describe('cache invalidation across checks', () => {
    it('updated household is reflected after cache invalidation', async () => {
      // First call: user-2 is NOT admin
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1'], ['user-2']));
      const r1 = await rbacService.enforceAdminOnly('h1', 'user-2', AuditAction.SETTINGS_UPDATE);
      expect(r1.allowed).toBe(false);

      // Promote user-2 to admin and invalidate cache
      rbacService.invalidateHousehold('h1');
      (getDoc as jest.Mock).mockResolvedValue(mockHousehold(['admin-1', 'user-2'], []));

      const r2 = await rbacService.enforceAdminOnly('h1', 'user-2', AuditAction.SETTINGS_UPDATE);
      expect(r2.allowed).toBe(true);
    });
  });
});
