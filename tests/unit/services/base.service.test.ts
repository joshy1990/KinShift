/**
 * Unit tests for BaseService
 *
 * Tests:
 *  1. handleError — maps auth, firestore, network, and unknown errors
 *  2. retry — exponential backoff, non-retryable errors, success after failure
 *  3. validateRequired — missing fields throw, complete data passes
 *  4. sanitizeString — trims whitespace, strips script tags
 */

import { BaseService, ServiceError } from '@/services/base.service';

// Create a concrete subclass to access protected methods
class TestService extends BaseService {
  public testHandleError(error: any): ServiceError {
    return this.handleError(error);
  }

  public testRetry<T>(
    operation: () => Promise<T>,
    maxRetries?: number,
    delay?: number,
  ): Promise<T> {
    return this.retry(operation, maxRetries, delay);
  }

  public testValidateRequired(data: Record<string, any>, fields: string[]): void {
    return this.validateRequired(data, fields);
  }

  public testSanitizeString(input: string): string {
    return this.sanitizeString(input);
  }
}

describe('BaseService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  // ── handleError ─────────────────────────────────────────────────────
  describe('handleError', () => {
    it('maps auth/user-not-found to friendly message', () => {
      const result = service.testHandleError({ code: 'auth/user-not-found' });
      expect(result.code).toBe('auth/user-not-found');
      expect(result.message).toContain('No account found');
    });

    it('maps auth/wrong-password', () => {
      const result = service.testHandleError({ code: 'auth/wrong-password' });
      expect(result.message).toContain('Incorrect password');
    });

    it('maps auth/email-already-in-use', () => {
      const result = service.testHandleError({ code: 'auth/email-already-in-use' });
      expect(result.message).toContain('already exists');
    });

    it('maps auth/weak-password', () => {
      const result = service.testHandleError({ code: 'auth/weak-password' });
      expect(result.message).toContain('8 characters');
    });

    it('maps auth/invalid-email', () => {
      const result = service.testHandleError({ code: 'auth/invalid-email' });
      expect(result.message).toContain('valid email');
    });

    it('maps auth/too-many-requests', () => {
      const result = service.testHandleError({ code: 'auth/too-many-requests' });
      expect(result.message).toContain('Too many');
    });

    it('maps auth/network-request-failed', () => {
      const result = service.testHandleError({ code: 'auth/network-request-failed' });
      expect(result.message).toContain('Network error');
    });

    it('maps unknown auth error to generic auth message', () => {
      const result = service.testHandleError({ code: 'auth/unknown-auth-code' });
      expect(result.message).toContain('Authentication error');
    });

    it('maps firestore/permission-denied', () => {
      const result = service.testHandleError({ code: 'firestore/permission-denied' });
      expect(result.code).toBe('firestore/permission-denied');
      expect(result.message).toContain('permission');
    });

    it('maps firestore/not-found', () => {
      const result = service.testHandleError({ code: 'firestore/not-found' });
      expect(result.message).toContain('not found');
    });

    it('maps firestore/already-exists', () => {
      const result = service.testHandleError({ code: 'firestore/already-exists' });
      expect(result.message).toContain('already exists');
    });

    it('maps firestore/resource-exhausted', () => {
      const result = service.testHandleError({ code: 'firestore/resource-exhausted' });
      expect(result.message).toContain('Too many requests');
    });

    it('maps unknown firestore error to generic db message', () => {
      const result = service.testHandleError({ code: 'firestore/some-other' });
      expect(result.message).toContain('Database error');
    });

    it('maps network error by message content', () => {
      const result = service.testHandleError({ message: 'Network request failed', code: 'network-request-failed' });
      expect(result.code).toBe('network/offline');
      expect(result.message).toContain('Network error');
    });

    it('maps generic error preserving message', () => {
      const result = service.testHandleError({ message: 'Something broke' });
      expect(result.code).toBe('unknown/error');
      expect(result.message).toBe('Something broke');
    });

    it('handles error with no message', () => {
      const result = service.testHandleError({});
      expect(result.code).toBe('unknown/error');
      expect(result.message).toContain('unexpected');
    });
  });

  // ── retry ───────────────────────────────────────────────────────────
  describe('retry', () => {
    it('returns on first success', async () => {
      const op = jest.fn().mockResolvedValue('ok');
      const result = await service.testRetry(op, 3, 1);
      expect(result).toBe('ok');
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('retries on transient failure then succeeds', async () => {
      const op = jest.fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValue('ok');

      const result = await service.testRetry(op, 3, 1);
      expect(result).toBe('ok');
      expect(op).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting retries', async () => {
      const op = jest.fn().mockRejectedValue(new Error('always fails'));

      await expect(service.testRetry(op, 2, 1)).rejects.toThrow('always fails');
      expect(op).toHaveBeenCalledTimes(2);
    });

    it('does not retry auth/user-not-found', async () => {
      const err = Object.assign(new Error('user not found'), { code: 'auth/user-not-found' });
      const op = jest.fn().mockRejectedValue(err);

      await expect(service.testRetry(op, 3, 1)).rejects.toThrow();
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('does not retry auth/wrong-password', async () => {
      const err = Object.assign(new Error('wrong pw'), { code: 'auth/wrong-password' });
      const op = jest.fn().mockRejectedValue(err);

      await expect(service.testRetry(op, 3, 1)).rejects.toThrow();
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('does not retry firestore/permission-denied', async () => {
      const err = Object.assign(new Error('denied'), { code: 'firestore/permission-denied' });
      const op = jest.fn().mockRejectedValue(err);

      await expect(service.testRetry(op, 3, 1)).rejects.toThrow();
      expect(op).toHaveBeenCalledTimes(1);
    });

    it('does not retry firestore/not-found', async () => {
      const err = Object.assign(new Error('not found'), { code: 'firestore/not-found' });
      const op = jest.fn().mockRejectedValue(err);

      await expect(service.testRetry(op, 3, 1)).rejects.toThrow();
      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  // ── validateRequired ───────────────────────────────────────────────
  describe('validateRequired', () => {
    it('passes when all required fields are present', () => {
      expect(() =>
        service.testValidateRequired({ name: 'Jo', email: 'a@b.c' }, ['name', 'email']),
      ).not.toThrow();
    });

    it('throws listing missing fields', () => {
      expect(() =>
        service.testValidateRequired({ name: 'Jo' }, ['name', 'email', 'age']),
      ).toThrow('email, age');
    });

    it('treats falsy values as missing', () => {
      expect(() =>
        service.testValidateRequired({ name: '', active: 0 }, ['name', 'active']),
      ).toThrow('name');
    });
  });

  // ── sanitizeString ─────────────────────────────────────────────────
  describe('sanitizeString', () => {
    it('trims whitespace', () => {
      expect(service.testSanitizeString('  hello  ')).toBe('hello');
    });

    it('strips script tags', () => {
      const input = 'Hello<script>alert("xss")</script>World';
      expect(service.testSanitizeString(input)).toBe('HelloWorld');
    });

    it('strips nested script tags', () => {
      const input = '<script type="text/javascript">bad()</script>';
      expect(service.testSanitizeString(input)).toBe('');
    });

    it('preserves safe HTML', () => {
      const input = '<b>bold</b> text';
      expect(service.testSanitizeString(input)).toBe('<b>bold</b> text');
    });
  });
});
