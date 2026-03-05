/**
 * Firestore Rules Security Tests (unit-level assertions).
 *
 * These tests verify that the Firestore rules file contains the expected
 * security patterns. They read the rules as text and assert key constraints.
 * Full integration testing requires the Firebase Emulator — see firestore.rules.test.js.
 */
import * as fs from 'fs';
import * as path from 'path';

const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
let rules: string;

beforeAll(() => {
  rules = fs.readFileSync(rulesPath, 'utf8');
});

describe('Firestore Rules — Security Patterns', () => {
  // ── auditLogs ─────────────────────────────────────────────────────
  describe('auditLogs collection', () => {
    it('scopes read to own userId', () => {
      expect(rules).toMatch(
        /match \/auditLogs\/\{logId\}[\s\S]*?allow read:.*resource\.data\.userId == request\.auth\.uid/
      );
    });

    it('requires userId match on create', () => {
      expect(rules).toMatch(
        /match \/auditLogs\/\{logId\}[\s\S]*?allow create:.*request\.resource\.data\.userId == request\.auth\.uid/
      );
    });

    it('blocks client-side updates', () => {
      expect(rules).toMatch(
        /match \/auditLogs\/\{logId\}[\s\S]*?allow update: if false/
      );
    });

    it('scopes delete to own userId', () => {
      expect(rules).toMatch(
        /match \/auditLogs\/\{logId\}[\s\S]*?allow delete:.*resource\.data\.userId == request\.auth\.uid/
      );
    });
  });

  // ── securityEvents ────────────────────────────────────────────────
  describe('securityEvents collection', () => {
    it('scopes read to own userId', () => {
      expect(rules).toMatch(
        /match \/securityEvents\/\{eventId\}[\s\S]*?allow read:.*resource\.data\.userId == request\.auth\.uid/
      );
    });

    it('blocks client-side updates', () => {
      expect(rules).toMatch(
        /match \/securityEvents\/\{eventId\}[\s\S]*?allow update: if false/
      );
    });
  });

  // ── households ────────────────────────────────────────────────────
  describe('households collection', () => {
    it('restricts list to own membership', () => {
      expect(rules).toMatch(
        /allow list:[\s\S]*?request\.auth\.uid in resource\.data\.members/
      );
    });

    it('does NOT have the old self-join bypass', () => {
      // The old rule allowed anyone to add themselves via diff().affectedKeys()
      expect(rules).not.toContain('affectedKeys');
    });

    it('requires creator to be in members and admins on create', () => {
      expect(rules).toMatch(/allow create:[\s\S]*?request\.auth\.uid in request\.resource\.data\.members/);
      expect(rules).toMatch(/allow create:[\s\S]*?request\.auth\.uid in request\.resource\.data\.admins/);
    });
  });

  // ── invitations ───────────────────────────────────────────────────
  describe('invitations collection', () => {
    it('does NOT allow read to all authenticated users', () => {
      // Old rule: allow read: if isAuthenticated();
      // New rule should scope to involved parties
      const invSection = rules.match(
        /match \/invitations\/\{invitationId\}[\s\S]*?(?=\/\/\s*=)/
      )?.[0] ?? '';
      expect(invSection).toContain('invitedBy');
      expect(invSection).toContain('invitedEmail');
    });

    it('requires invitedBy to match auth uid on create', () => {
      expect(rules).toMatch(
        /match \/invitations\/\{invitationId\}[\s\S]*?allow create:[\s\S]*?request\.resource\.data\.invitedBy == request\.auth\.uid/
      );
    });
  });

  // ── subscriptions ─────────────────────────────────────────────────
  describe('subscriptions collection', () => {
    it('only allows free-tier creates from client', () => {
      expect(rules).toMatch(
        /allow create:[\s\S]*?request\.resource\.data\.tier == 'free'/
      );
    });

    it('prevents client-side tier changes on update', () => {
      expect(rules).toMatch(
        /allow update:[\s\S]*?request\.resource\.data\.tier == resource\.data\.tier/
      );
    });

    it('blocks client-side deletion', () => {
      expect(rules).toMatch(
        /match \/subscriptions\/\{subscriptionId\}[\s\S]*?allow delete: if false/
      );
    });
  });

  // ── dayMessages ───────────────────────────────────────────────────
  describe('dayMessages collection', () => {
    it('blocks updates (immutable messages)', () => {
      expect(rules).toMatch(
        /match \/dayMessages\/\{messageId\}[\s\S]*?allow update: if false/
      );
    });
  });

  // ── notifications ─────────────────────────────────────────────────
  describe('notifications collection', () => {
    it('validates required fields on create', () => {
      expect(rules).toMatch(
        /match \/notifications\/\{notificationId\}[\s\S]*?allow create:[\s\S]*?hasAll\(\['userId', 'type', 'title', 'body'\]\)/
      );
    });
  });

  // ── helper functions ──────────────────────────────────────────────
  describe('helper functions', () => {
    it('defines isValidString helper', () => {
      expect(rules).toContain('function isValidString');
    });

    it('has a catch-all deny rule', () => {
      expect(rules).toContain('allow read, write: if false');
    });
  });
});
