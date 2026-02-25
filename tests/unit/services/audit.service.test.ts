/**
 * Unit tests for AuditService
 *
 * Tests the Firestore audit logging, querying, and TTL cleanup.
 * Uses mocked Firestore compat layer.
 */

// Mock Firestore compat before importing service
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'audit-1' });
const mockGetDocs = jest.fn();
const mockQuery = jest.fn((...args: any[]) => args);
const mockCollection = jest.fn((...args: any[]) => args);
const mockWhere = jest.fn((...args: any[]) => args);
const mockOrderBy = jest.fn((...args: any[]) => args);
const mockLimit = jest.fn((...args: any[]) => args);
const mockWriteBatch = jest.fn();

jest.mock('@/config/firestore.compat', () => ({
  addDoc: (...args: any[]) => mockAddDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  collection: (...args: any[]) => mockCollection(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
}));

jest.mock('@/config/firebase.config', () => ({
  db: 'mock-db',
  COLLECTIONS: {},
}));

import { auditService } from '@/services/audit.service';

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── logAction ───────────────────────────────────────────────────────
  describe('logAction', () => {
    it('writes an audit log document to Firestore', async () => {
      await auditService.logAction('user-1', 'shift:create', 'shift', 'shift-1', { title: 'Day Shift' });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const logData = mockAddDoc.mock.calls[0][1];
      expect(logData.userId).toBe('user-1');
      expect(logData.action).toBe('shift:create');
      expect(logData.resourceType).toBe('shift');
      expect(logData.resourceId).toBe('shift-1');
      expect(logData.changes).toEqual({ title: 'Day Shift' });
      expect(logData.timestamp).toBeInstanceOf(Date);
    });

    it('does not throw when Firestore fails', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('write failed'));

      await expect(
        auditService.logAction('u1', 'shift:delete', 'shift', 's1'),
      ).resolves.toBeUndefined();
    });
  });

  // ── getUserAuditLogs ───────────────────────────────────────────────
  describe('getUserAuditLogs', () => {
    it('returns mapped audit logs for a user', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            id: 'log-1',
            data: () => ({
              userId: 'user-1',
              action: 'shift:create',
              resourceType: 'shift',
              resourceId: 'shift-1',
              timestamp: { toDate: () => new Date('2026-01-01') },
            }),
          },
        ],
      });

      const logs = await auditService.getUserAuditLogs('user-1');
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('log-1');
      expect(logs[0].action).toBe('shift:create');
      expect(logs[0].timestamp).toEqual(new Date('2026-01-01'));
    });

    it('respects maxResults parameter capped at 200', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await auditService.getUserAuditLogs('user-1', 500);

      // mockLimit should have been called with 200 (the cap)
      expect(mockLimit).toHaveBeenCalledWith(200);
    });

    it('returns empty array on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('query failed'));

      const logs = await auditService.getUserAuditLogs('user-1');
      expect(logs).toEqual([]);
    });
  });

  // ── getResourceAuditLogs ──────────────────────────────────────────
  describe('getResourceAuditLogs', () => {
    it('queries by resourceType and resourceId', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await auditService.getResourceAuditLogs('shift', 'shift-42');

      expect(mockWhere).toHaveBeenCalledWith('resourceType', '==', 'shift');
      expect(mockWhere).toHaveBeenCalledWith('resourceId', '==', 'shift-42');
    });

    it('returns empty array on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('fail'));
      const logs = await auditService.getResourceAuditLogs('shift', 's1');
      expect(logs).toEqual([]);
    });
  });

  // ── getHouseholdAuditLogs ─────────────────────────────────────────
  describe('getHouseholdAuditLogs', () => {
    it('queries by household resourceId', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await auditService.getHouseholdAuditLogs('hh-1', 50);

      expect(mockWhere).toHaveBeenCalledWith('resourceId', '==', 'hh-1');
      expect(mockLimit).toHaveBeenCalledWith(50);
    });
  });

  // ── logHouseholdAction ────────────────────────────────────────────
  describe('logHouseholdAction', () => {
    it('delegates to logAction with "household" resourceType', async () => {
      await auditService.logHouseholdAction('hh-1', 'user-1', 'member:add', { name: 'Alice' });

      const logData = mockAddDoc.mock.calls[0][1];
      expect(logData.resourceType).toBe('household');
      expect(logData.resourceId).toBe('hh-1');
      expect(logData.action).toBe('member:add');
    });
  });

  // ── logSecurityEvent ──────────────────────────────────────────────
  describe('logSecurityEvent', () => {
    it('writes to securityEvents collection', async () => {
      await auditService.logSecurityEvent('user-1', 'BRUTE_FORCE', { attempts: 10 });

      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const logData = mockAddDoc.mock.calls[0][1];
      expect(logData.eventType).toBe('BRUTE_FORCE');
      expect(logData.severity).toBe('HIGH');
      expect(logData.details).toEqual({ attempts: 10 });
    });

    it('does not throw on Firestore failure', async () => {
      mockAddDoc.mockRejectedValueOnce(new Error('denied'));

      await expect(
        auditService.logSecurityEvent('u1', 'SUSPICIOUS', {}),
      ).resolves.toBeUndefined();
    });
  });

  // ── cleanupExpiredAuditLogs ───────────────────────────────────────
  describe('cleanupExpiredAuditLogs', () => {
    it('returns 0 when no expired logs', async () => {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      const count = await auditService.cleanupExpiredAuditLogs();
      expect(count).toBe(0);
    });

    it('deletes expired logs in batches', async () => {
      const mockBatchDelete = jest.fn();
      const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
      mockWriteBatch.mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      });

      const fakeDocs = Array.from({ length: 3 }, (_, i) => ({
        ref: { id: `log-${i}` },
      }));
      mockGetDocs.mockResolvedValueOnce({ empty: false, docs: fakeDocs });

      const count = await auditService.cleanupExpiredAuditLogs();
      expect(count).toBe(3);
      expect(mockBatchDelete).toHaveBeenCalledTimes(3);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('returns 0 on error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('fail'));

      const count = await auditService.cleanupExpiredAuditLogs();
      expect(count).toBe(0);
    });
  });
});
