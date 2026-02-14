/**
 * Unit tests for RBAC service — pure helper methods + sync logic
 * Async Firestore-dependent methods are tested in integration tests
 */
import { rbacService, AuditAction, RBACResult } from '@/services/rbac.service';

describe('RBACService', () => {
  // ── AuditAction enum ────────────────────────────────────────────────────
  describe('AuditAction', () => {
    it('has 15 distinct action values', () => {
      const values = Object.values(AuditAction);
      expect(values.length).toBe(15);
      expect(new Set(values).size).toBe(15);
    });

    it('shift actions are prefixed with shift:', () => {
      expect(AuditAction.SHIFT_CREATE).toBe('shift:create');
      expect(AuditAction.SHIFT_UPDATE).toBe('shift:update');
      expect(AuditAction.SHIFT_DELETE).toBe('shift:delete');
    });

    it('member actions are prefixed with member:', () => {
      expect(AuditAction.MEMBER_INVITE).toBe('member:invite');
      expect(AuditAction.MEMBER_REMOVE).toBe('member:remove');
      expect(AuditAction.MEMBER_PROMOTE).toBe('member:promote');
      expect(AuditAction.MEMBER_DEMOTE).toBe('member:demote');
    });

    it('includes daynote and subscription actions', () => {
      expect(AuditAction.DAYNOTE_CREATE).toBe('daynote:create');
      expect(AuditAction.SUBSCRIPTION_CANCEL).toBe('subscription:cancel');
      expect(AuditAction.SUBSCRIPTION_UPGRADE).toBe('subscription:upgrade');
    });

    it('includes household lifecycle actions', () => {
      expect(AuditAction.HOUSEHOLD_DELETE).toBe('household:delete');
      expect(AuditAction.HOUSEHOLD_TRANSFER).toBe('household:transfer');
    });
  });

  // ── getHTTPStatus ──────────────────────────────────────────────────────
  describe('getHTTPStatus', () => {
    it.each<[RBACResult['code'], number]>([
      ['FORBIDDEN', 403],
      ['UNAUTHORIZED', 401],
      ['NOT_FOUND', 404],
      ['INVALID_STATE', 400],
      [undefined, 403],
    ])('maps code %s → HTTP %d', (code, expected) => {
      const result: RBACResult = { allowed: false, code };
      expect(rbacService.getHTTPStatus(result)).toBe(expected);
    });
  });

  // ── createErrorMessage ─────────────────────────────────────────────────
  describe('createErrorMessage', () => {
    it('returns reason string when not allowed', () => {
      const result: RBACResult = { allowed: false, reason: 'Admin only' };
      expect(rbacService.createErrorMessage(result)).toBe('Admin only');
    });

    it('returns "Permission denied" when no reason provided', () => {
      const result: RBACResult = { allowed: false };
      expect(rbacService.createErrorMessage(result)).toBe('Permission denied');
    });

    it('returns empty string when allowed', () => {
      const result: RBACResult = { allowed: true };
      expect(rbacService.createErrorMessage(result)).toBe('');
    });
  });

  // ── enforceSelfOperation ───────────────────────────────────────────────
  describe('enforceSelfOperation', () => {
    it('blocks self-operation by default', async () => {
      const result = await rbacService.enforceSelfOperation(
        'user-1', 'user-1', AuditAction.MEMBER_REMOVE
      );
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('INVALID_STATE');
      expect(result.reason).toContain('yourself');
    });

    it('allows self-operation when allowSelf=true', async () => {
      const result = await rbacService.enforceSelfOperation(
        'user-1', 'user-1', AuditAction.SHIFT_CREATE, true
      );
      expect(result.allowed).toBe(true);
    });

    it('allows operation on different user', async () => {
      const result = await rbacService.enforceSelfOperation(
        'user-1', 'user-2', AuditAction.MEMBER_REMOVE
      );
      expect(result.allowed).toBe(true);
    });
  });

  // ── Cache helpers ──────────────────────────────────────────────────────
  describe('cache management', () => {
    it('invalidateHousehold does not throw', () => {
      expect(() => rbacService.invalidateHousehold('nonexistent')).not.toThrow();
    });

    it('clearCache does not throw', () => {
      expect(() => rbacService.clearCache()).not.toThrow();
    });
  });
});
