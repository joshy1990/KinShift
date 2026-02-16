/**
 * Unit tests for HouseholdService — join code expiry, createHousehold,
 * regenerateJoinCode, joinHouseholdByCode, and permission checks.
 *
 * These tests cover the bugs fixed in the household join flow audit:
 *  1. Join code expiry is enforced (2-day window)
 *  2. createHousehold stores joinCodeCreatedAt
 *  3. regenerateJoinCode resets joinCodeCreatedAt
 *  4. Already-a-member check blocks double-join
 *  5. Invalid join code throws
 *  6. Firestore Timestamp.toDate() is handled correctly
 *  7. Subscription tier limits are checked before adding
 */

// ────────────────────────────────────────────────────
// Mocks  — must be defined BEFORE imports
// ────────────────────────────────────────────────────

const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockWriteBatch = jest.fn();
const mockArrayUnion = jest.fn((...v: any[]) => ({ __op: 'arrayUnion', values: v }));
const mockArrayRemove = jest.fn((...v: any[]) => ({ __op: 'arrayRemove', values: v }));

jest.mock('@/config/firestore.compat', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  arrayUnion: (...args: any[]) => mockArrayUnion(...args),
  arrayRemove: (...args: any[]) => mockArrayRemove(...args),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  onSnapshot: jest.fn(),
  DocumentSnapshot: {},
  QuerySnapshot: {},
}));

jest.mock('@/config/firebase.config', () => ({
  db: {},
  COLLECTIONS: {
    USERS: 'users',
    HOUSEHOLDS: 'households',
    SHIFTS: 'shifts',
    DAY_NOTES: 'dayNotes',
    INVITATIONS: 'invitations',
    NOTIFICATIONS: 'notifications',
    SUBSCRIPTIONS: 'subscriptions',
  },
  JOIN_CODE_EXPIRY_DAYS: 2,
}));

jest.mock('@/services/subscription.service', () => ({
  subscriptionService: {
    canAddMember: jest.fn().mockResolvedValue({ allowed: true }),
    getUserSubscription: jest.fn().mockResolvedValue(null),
    getEffectiveTierLimits: jest.fn().mockReturnValue({
      maxHouseholds: 1,
      maxMembersPerHousehold: 5,
    }),
  },
}));

jest.mock('@/services/audit.service', () => ({
  auditService: {
    logHouseholdAction: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/rbac.service', () => ({
  rbacService: {
    invalidateHousehold: jest.fn(),
  },
}));

// ────────────────────────────────────────────────────
// Imports AFTER mocks
// ────────────────────────────────────────────────────
import { householdService } from '@/services/household.service';
import { subscriptionService } from '@/services/subscription.service';

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

/** Build a mock Firestore query snapshot */
function makeQuerySnapshot(
  docs: Array<{ id: string; data: Record<string, any> }>,
) {
  return {
    empty: docs.length === 0,
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
      ref: { id: d.id },
    })),
    size: docs.length,
  };
}

/** Build a mock Firestore document snapshot */
function makeDocSnapshot(
  id: string,
  data: Record<string, any> | null,
) {
  return {
    id,
    exists: () => data !== null,
    data: () => data,
  };
}

/** A Date N days ago */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.mockReturnValue('query-ref');
  mockWhere.mockReturnValue('where-clause');
  mockCollection.mockReturnValue('collection-ref');
  mockDoc.mockReturnValue('doc-ref');
  mockUpdateDoc.mockResolvedValue(undefined);
});

// ═════════════════════════════════════════════════════
// createHousehold
// ═════════════════════════════════════════════════════
describe('createHousehold', () => {
  it('returns a household with joinCodeCreatedAt set', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'hh-1' });

    const result = await householdService.createHousehold('Test Family', 'user-1');

    expect(result.joinCodeCreatedAt).toBeInstanceOf(Date);
    expect(result.joinCode).toHaveLength(6);
    expect(result.id).toBe('hh-1');
  });

  it('sets creator as sole admin and member', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'hh-2' });

    const result = await householdService.createHousehold('Family', 'creator-1');

    expect(result.admins).toEqual(['creator-1']);
    expect(result.members).toEqual(['creator-1']);
    expect(result.creatorId).toBe('creator-1');
  });

  it('stores joinCodeCreatedAt in the Firestore document', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'hh-3' });

    await householdService.createHousehold('Family', 'user-1');

    const docData = mockAddDoc.mock.calls[0][1]; // second arg to addDoc
    expect(docData).toHaveProperty('joinCodeCreatedAt');
    expect(docData.joinCodeCreatedAt).toBeInstanceOf(Date);
  });

  it('generates join code from allowed characters only', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'hh-4' });

    const result = await householdService.createHousehold('Family', 'user-1');

    // Alphabet excludes I, O, 0, 1 to avoid ambiguity
    const allowedChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (const char of result.joinCode) {
      expect(allowedChars).toContain(char);
    }
  });

  it('applies default settings when none provided', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'hh-5' });

    const result = await householdService.createHousehold('Family', 'user-1');

    expect(result.settings).toEqual({
      allowMemberEditOthers: false,
      requireApprovalForShifts: false,
      notifyOnConflicts: true,
    });
  });
});

// ═════════════════════════════════════════════════════
// joinHouseholdByCode
// ═════════════════════════════════════════════════════
describe('joinHouseholdByCode', () => {
  const validHousehold = {
    id: 'hh-100',
    name: 'Smith Family',
    joinCode: 'ABC123',
    joinCodeCreatedAt: new Date(), // fresh code
    admins: ['admin-1'],
    members: ['admin-1'],
    creatorId: 'admin-1',
    memberJoinDates: { 'admin-1': new Date() },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Default: getDocs returns the valid household
    mockGetDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: 'hh-100', data: { ...validHousehold } }]),
    );
    // Mock migratePersonalShiftsToHousehold — getDocs for shifts returns empty
    mockGetDocs.mockResolvedValueOnce(
      makeQuerySnapshot([{ id: 'hh-100', data: { ...validHousehold } }]),
    ).mockResolvedValueOnce(
      makeQuerySnapshot([]), // no personal shifts to migrate
    );
    (subscriptionService.canAddMember as jest.Mock).mockResolvedValue({ allowed: true });
  });

  it('succeeds with a valid, non-expired join code', async () => {
    const result = await householdService.joinHouseholdByCode('ABC123', 'new-user');

    expect(result.members).toContain('new-user');
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('uppercases the join code before querying', async () => {
    await householdService.joinHouseholdByCode('abc123', 'new-user');

    // The where() call should use uppercased code
    expect(mockWhere).toHaveBeenCalledWith('joinCode', '==', 'ABC123');
  });

  it('throws "Invalid join code" when no household matches', async () => {
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValue(makeQuerySnapshot([]));

    await expect(
      householdService.joinHouseholdByCode('XXXXXX', 'user-1'),
    ).rejects.toThrow('Invalid join code');
  });

  it('throws when user is already a member', async () => {
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValue(
      makeQuerySnapshot([{
        id: 'hh-100',
        data: { ...validHousehold, members: ['admin-1', 'user-1'] },
      }]),
    );

    await expect(
      householdService.joinHouseholdByCode('ABC123', 'user-1'),
    ).rejects.toThrow('already a member');
  });

  // ── Expiry tests (the key regression we're guarding) ──
  it('throws when join code is expired (> 2 days old, JS Date)', async () => {
    const expiredDate = daysAgo(3); // 3 days ago
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValue(
      makeQuerySnapshot([{
        id: 'hh-100',
        data: { ...validHousehold, joinCodeCreatedAt: expiredDate },
      }]),
    );

    await expect(
      householdService.joinHouseholdByCode('ABC123', 'new-user'),
    ).rejects.toThrow('expired');
  });

  it('throws when join code is expired (Firestore Timestamp with toDate())', async () => {
    // Simulate Firestore Timestamp object
    const expiredTimestamp = {
      toDate: () => daysAgo(5),
      seconds: Math.floor(daysAgo(5).getTime() / 1000),
      nanoseconds: 0,
    };
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValue(
      makeQuerySnapshot([{
        id: 'hh-100',
        data: { ...validHousehold, joinCodeCreatedAt: expiredTimestamp },
      }]),
    );

    await expect(
      householdService.joinHouseholdByCode('ABC123', 'new-user'),
    ).rejects.toThrow('expired');
  });

  it('succeeds when join code is fresh (< 2 days old)', async () => {
    const freshDate = daysAgo(1); // 1 day ago — within window
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValueOnce(
      makeQuerySnapshot([{
        id: 'hh-100',
        data: { ...validHousehold, joinCodeCreatedAt: freshDate },
      }]),
    ).mockResolvedValueOnce(
      makeQuerySnapshot([]), // no shifts to migrate
    );

    const result = await householdService.joinHouseholdByCode('ABC123', 'new-user');
    expect(result.members).toContain('new-user');
  });

  it('succeeds when joinCodeCreatedAt is missing (legacy data)', async () => {
    const { joinCodeCreatedAt, ...legacyData } = validHousehold;
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValueOnce(
      makeQuerySnapshot([{ id: 'hh-100', data: legacyData }]),
    ).mockResolvedValueOnce(
      makeQuerySnapshot([]), // no shifts to migrate
    );

    const result = await householdService.joinHouseholdByCode('ABC123', 'new-user');
    expect(result.members).toContain('new-user');
  });

  // ── Subscription tier limit ──
  it('throws when subscription tier limit is reached', async () => {
    (subscriptionService.canAddMember as jest.Mock).mockResolvedValue({
      allowed: false,
      reason: 'Free tier allows max 2 members',
    });
    mockGetDocs.mockReset();
    mockGetDocs.mockResolvedValue(
      makeQuerySnapshot([{ id: 'hh-100', data: { ...validHousehold } }]),
    );

    await expect(
      householdService.joinHouseholdByCode('ABC123', 'new-user'),
    ).rejects.toThrow('Free tier allows max 2 members');
  });
});

// ═════════════════════════════════════════════════════
// regenerateJoinCode
// ═════════════════════════════════════════════════════
describe('regenerateJoinCode', () => {
  it('returns a new 6-char code', async () => {
    const newCode = await householdService.regenerateJoinCode('hh-1');
    expect(newCode).toHaveLength(6);
  });

  it('updates joinCodeCreatedAt in Firestore', async () => {
    await householdService.regenerateJoinCode('hh-1');

    expect(mockUpdateDoc).toHaveBeenCalled();
    const updateData = mockUpdateDoc.mock.calls[0][1];
    expect(updateData).toHaveProperty('joinCodeCreatedAt');
    expect(updateData.joinCodeCreatedAt).toBeInstanceOf(Date);
    expect(updateData).toHaveProperty('joinCode');
    expect(updateData).toHaveProperty('updatedAt');
  });
});

// ═════════════════════════════════════════════════════
// canRemoveMember — permission checks
// ═════════════════════════════════════════════════════
describe('canRemoveMember', () => {
  beforeEach(() => {
    // Mock getHousehold via getDoc
    mockGetDoc.mockResolvedValue(
      makeDocSnapshot('hh-1', {
        name: 'Family',
        admins: ['admin-1', 'admin-2'],
        members: ['admin-1', 'admin-2', 'member-1'],
        creatorId: 'admin-1',
      }),
    );
  });

  it('allows a member to remove themselves (leave)', async () => {
    const result = await householdService.canRemoveMember('hh-1', 'member-1', 'member-1');
    expect(result.allowed).toBe(true);
  });

  it('allows an admin to remove another member', async () => {
    const result = await householdService.canRemoveMember('hh-1', 'admin-1', 'member-1');
    expect(result.allowed).toBe(true);
  });

  it('blocks a non-admin from removing someone else', async () => {
    const result = await householdService.canRemoveMember('hh-1', 'member-1', 'admin-2');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('admin');
  });

  it('blocks the last admin from removing themselves', async () => {
    mockGetDoc.mockResolvedValue(
      makeDocSnapshot('hh-1', {
        name: 'Family',
        admins: ['admin-1'], // only admin
        members: ['admin-1', 'member-1'],
        creatorId: 'admin-1',
      }),
    );

    const result = await householdService.canRemoveMember('hh-1', 'admin-1', 'admin-1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('last admin');
  });
});
