/**
 * Tests for firestore.compat.ts — specifically the optimisticWrite behaviour.
 *
 * @react-native-firebase writes to local cache instantly but the returned
 * Promise waits for server ACK. Our compat layer races the write against
 * a 3 s timeout so the UI never blocks.
 *
 * These tests mock the underlying native Firebase module and validate that:
 *  1. Fast writes (<3 s) resolve normally.
 *  2. Slow writes (>3 s) still resolve (optimistic timeout).
 *  3. Real errors propagate immediately.
 *  4. addDoc returns a document ID even when the write is slow.
 *  5. writeBatch.commit uses the same optimistic strategy.
 */

// ────────────────────────────────────────────────────
// Mock @react-native-firebase/firestore
// ────────────────────────────────────────────────────
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn();

const mockDocRef = (id = 'auto-id-123') => ({
  id,
  path: `test-collection/${id}`,
  set: mockSet,
  update: mockUpdate,
  delete: mockDelete,
});

const mockCollectionRef = (docOverrides?: ReturnType<typeof mockDocRef>) => ({
  path: 'test-collection',
  doc: jest.fn(() => docOverrides ?? mockDocRef()),
});

// Mock firebase.config.ts — db instance
jest.mock('../../../src/config/firebase.config', () => ({
  db: {
    collection: jest.fn(() => mockCollectionRef()),
    doc: jest.fn(() => mockDocRef()),
    batch: jest.fn(() => ({
      set: mockBatchSet,
      update: mockBatchUpdate,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
  },
}));

jest.mock('@react-native-firebase/firestore', () => {
  const Timestamp = { now: () => ({ seconds: 0, nanoseconds: 0 }) };
  const FieldValue = {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    arrayUnion: (...v: any[]) => ({ _type: 'arrayUnion', values: v }),
    arrayRemove: (...v: any[]) => ({ _type: 'arrayRemove', values: v }),
    increment: (n: number) => ({ _type: 'increment', value: n }),
    delete: () => ({ _type: 'delete' }),
  };
  return {
    __esModule: true,
    default: Object.assign(() => ({}), { Timestamp, FieldValue }),
    Timestamp,
    FieldValue,
  };
});

// ────────────────────────────────────────────────────
// Import AFTER mocks are in place
// ────────────────────────────────────────────────────
import {
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from '../../../src/config/firestore.compat';

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────
/** Returns a promise that resolves after `ms` milliseconds. */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Creates a controllable promise (resolve/reject exposed). */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('optimisticWrite (via public API)', () => {
  // ─── setDoc ────────────────────────────────────
  describe('setDoc', () => {
    it('resolves normally when server responds quickly', async () => {
      mockSet.mockResolvedValueOnce(undefined);

      await expect(
        setDoc(mockDocRef(), { foo: 'bar' }),
      ).resolves.toBeUndefined();

      expect(mockSet).toHaveBeenCalledWith({ foo: 'bar' });
    });

    it('resolves via optimistic timeout when server is slow', async () => {
      // Server never resolves within the test
      const d = deferred();
      mockSet.mockReturnValueOnce(d.promise);

      // setDoc should still resolve (within ~3 s timeout)
      await expect(
        setDoc(mockDocRef(), { slow: true }),
      ).resolves.toBeUndefined();

      // Cleanup — resolve background promise
      d.resolve(undefined);
    }, 10000);

    it('propagates real errors immediately', async () => {
      mockSet.mockRejectedValueOnce(new Error('PERMISSION_DENIED'));

      await expect(
        setDoc(mockDocRef(), { fail: true }),
      ).rejects.toThrow('PERMISSION_DENIED');
    });

    it('passes merge option through to native set', async () => {
      mockSet.mockResolvedValueOnce(undefined);
      const ref = mockDocRef();

      await setDoc(ref, { merged: true }, { merge: true });

      expect(ref.set).toHaveBeenCalledWith({ merged: true }, { merge: true });
    });
  });

  // ─── updateDoc ─────────────────────────────────
  describe('updateDoc', () => {
    it('resolves normally when server responds quickly', async () => {
      mockUpdate.mockResolvedValueOnce(undefined);

      await expect(
        updateDoc(mockDocRef(), { updated: true }),
      ).resolves.toBeUndefined();
    });

    it('resolves via optimistic timeout when server is slow', async () => {
      const d = deferred();
      mockUpdate.mockReturnValueOnce(d.promise);

      await expect(
        updateDoc(mockDocRef(), { slow: true }),
      ).resolves.toBeUndefined();

      d.resolve(undefined);
    }, 10000);

    it('propagates real errors immediately', async () => {
      mockUpdate.mockRejectedValueOnce(new Error('NOT_FOUND'));

      await expect(
        updateDoc(mockDocRef(), { fail: true }),
      ).rejects.toThrow('NOT_FOUND');
    });
  });

  // ─── deleteDoc ─────────────────────────────────
  describe('deleteDoc', () => {
    it('resolves normally when server responds quickly', async () => {
      mockDelete.mockResolvedValueOnce(undefined);

      await expect(deleteDoc(mockDocRef())).resolves.toBeUndefined();
    });

    it('resolves via optimistic timeout when server is slow', async () => {
      const d = deferred();
      mockDelete.mockReturnValueOnce(d.promise);

      await expect(deleteDoc(mockDocRef())).resolves.toBeUndefined();

      d.resolve(undefined);
    }, 10000);
  });

  // ─── addDoc ────────────────────────────────────
  describe('addDoc', () => {
    it('returns an object with the pre-generated document ID', async () => {
      mockSet.mockResolvedValueOnce(undefined);

      const colRef = mockCollectionRef(mockDocRef('gen-id-456'));
      const result = await addDoc(colRef, { data: 123 });

      expect(result).toEqual({ id: 'gen-id-456' });
      expect(colRef.doc).toHaveBeenCalled(); // pre-generated ID
    });

    it('returns the ID even when the server is slow (optimistic)', async () => {
      const d = deferred();
      mockSet.mockReturnValueOnce(d.promise);

      const colRef = mockCollectionRef(mockDocRef('slow-id-789'));
      const result = await addDoc(colRef, { data: 'slow' });

      expect(result).toEqual({ id: 'slow-id-789' });

      d.resolve(undefined);
    }, 10000);

    it('propagates real errors', async () => {
      mockSet.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'));

      const colRef = mockCollectionRef(mockDocRef());
      await expect(addDoc(colRef, {})).rejects.toThrow('QUOTA_EXCEEDED');
    });
  });

  // ─── writeBatch ────────────────────────────────
  describe('writeBatch', () => {
    it('commit resolves normally when server responds quickly', async () => {
      mockBatchCommit.mockResolvedValueOnce(undefined);

      const batch = writeBatch({});
      batch.set(mockDocRef(), { a: 1 });
      await expect(batch.commit()).resolves.toBeUndefined();
    });

    it('commit resolves via optimistic timeout when server is slow', async () => {
      const d = deferred();
      mockBatchCommit.mockReturnValueOnce(d.promise);

      const batch = writeBatch({});
      batch.set(mockDocRef(), { a: 1 });
      await expect(batch.commit()).resolves.toBeUndefined();

      d.resolve(undefined);
    }, 10000);

    it('delegates set/update/delete to the underlying batch', () => {
      const batch = writeBatch({});
      const ref = mockDocRef();

      batch.set(ref, { x: 1 });
      batch.update(ref, { x: 2 });
      batch.delete(ref);

      expect(mockBatchSet).toHaveBeenCalledWith(ref, { x: 1 });
      expect(mockBatchUpdate).toHaveBeenCalledWith(ref, { x: 2 });
      expect(mockBatchDelete).toHaveBeenCalledWith(ref);
    });

    it('set with merge passes options through', () => {
      const batch = writeBatch({});
      const ref = mockDocRef();

      batch.set(ref, { y: 1 }, { merge: true });

      expect(mockBatchSet).toHaveBeenCalledWith(ref, { y: 1 }, { merge: true });
    });
  });
});
