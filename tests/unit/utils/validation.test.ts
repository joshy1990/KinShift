/**
 * Validation utility tests — covers security-hardened validators and sanitizers.
 */
import { validators, sanitize, ValidationError } from '@/utils/validation';

describe('validators', () => {
  // ── email (stricter regex) ──────────────────────────────────────────
  describe('email', () => {
    it('accepts valid emails', () => {
      expect(validators.email('user@example.com')).toBe(true);
      expect(validators.email('first.last@domain.co.uk')).toBe(true);
      expect(validators.email('user+tag@example.org')).toBe(true);
      expect(validators.email('name123@test-domain.io')).toBe(true);
    });

    it('rejects emails without proper TLD (min 2 chars)', () => {
      expect(validators.email('user@domain.c')).toBe(false);
    });

    it('rejects emails with spaces', () => {
      expect(validators.email('user @example.com')).toBe(false);
      expect(validators.email('us er@example.com')).toBe(false);
    });

    it('rejects empty/falsy values', () => {
      expect(validators.email('')).toBe(false);
      expect(validators.email(null as any)).toBe(false);
      expect(validators.email(undefined as any)).toBe(false);
    });

    it('rejects emails longer than 254 chars', () => {
      const longEmail = 'a'.repeat(250) + '@b.com';
      expect(validators.email(longEmail)).toBe(false);
    });

    it('rejects emails without @ sign', () => {
      expect(validators.email('userexample.com')).toBe(false);
    });

    it('rejects emails with special chars in local part beyond allowed set', () => {
      // These chars are not in [a-zA-Z0-9._%+-]
      expect(validators.email('user!name@example.com')).toBe(false);
      expect(validators.email('user<script>@example.com')).toBe(false);
    });
  });

  // ── noXSS ────────────────────────────────────────────────────────────
  describe('noXSS', () => {
    it('returns true for clean text', () => {
      expect(validators.noXSS('Hello world')).toBe(true);
      expect(validators.noXSS('Meeting at 6pm & dinner')).toBe(true);
    });

    it('returns false for script tags', () => {
      expect(validators.noXSS('<script>alert("xss")</script>')).toBe(false);
    });

    it('returns false for event handlers', () => {
      expect(validators.noXSS('<img onerror="alert(1)">')).toBe(false);
    });

    it('returns false for javascript: protocol', () => {
      expect(validators.noXSS('javascript:void(0)')).toBe(false);
    });
  });
});

describe('sanitize', () => {
  describe('text', () => {
    it('trims whitespace', () => {
      expect(sanitize.text('  hello  ')).toBe('hello');
    });

    it('truncates to maxLength', () => {
      const result = sanitize.text('abcdefghij', 5);
      expect(result).toBe('abcde');
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('uses default maxLength of 1000', () => {
      const longText = 'a'.repeat(2000);
      expect(sanitize.text(longText).length).toBeLessThanOrEqual(1000);
    });

    it('returns empty string for falsy input', () => {
      expect(sanitize.text('')).toBe('');
      expect(sanitize.text(null as any)).toBe('');
      expect(sanitize.text(undefined as any)).toBe('');
    });
  });

  describe('email', () => {
    it('lowercases and trims', () => {
      expect(sanitize.email('  User@Example.COM  ')).toBe('user@example.com');
    });

    it('returns empty string for falsy input', () => {
      expect(sanitize.email('')).toBe('');
    });
  });
});
