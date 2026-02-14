/**
 * Firebase Firestore Compatibility Layer
 * Provides Firebase JS SDK-like API using React Native Firebase under the hood
 * This allows gradual migration without changing all service files at once
 */

import firestore from '@react-native-firebase/firestore';
import { db } from './firebase.config';

// ========================================
// OPTIMISTIC WRITE HELPER
// ========================================
// @react-native-firebase writes to local cache instantly (real-time listeners
// fire), but the returned Promise waits for the server ACK. On slow or flaky
// connections the ACK can take many seconds, blocking the UI.
//
// This helper races the actual write against a short timeout. If the server
// responds within the window → normal flow. If not → the data IS already in
// local cache and will sync in the background, so we return success.
const WRITE_TIMEOUT_MS = 3000;

class WriteTimeoutError extends Error {
  constructor() { super('WRITE_TIMEOUT'); this.name = 'WriteTimeoutError'; }
}

async function optimisticWrite<T>(
  writePromise: Promise<T>,
  label: string = 'write',
): Promise<T | undefined> {
  const start = Date.now();

  try {
    const result = await Promise.race([
      writePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new WriteTimeoutError()), WRITE_TIMEOUT_MS),
      ),
    ]);
    const elapsed = Date.now() - start;
    if (elapsed > 1000) {
      console.log(`[Firestore] ${label} completed in ${elapsed}ms (slow)`);
    }
    return result;
  } catch (err: any) {
    if (err instanceof WriteTimeoutError) {
      console.log(`[Firestore] ${label} cached locally, server sync pending (>${WRITE_TIMEOUT_MS}ms)`);
      // Server sync continues in the background — log outcome but don't block
      writePromise
        .then(() => console.log(`[Firestore] ${label} server sync completed`))
        .catch(e => console.warn(`[Firestore] ${label} server sync failed:`, e));
      return undefined;
    }
    throw err; // Real error — propagate immediately
  }
}

/**
 * Get a document reference
 */
export const doc = (firestoreInstance: any, collectionPath: string, ...pathSegments: string[]): any => {
  const fullPath = [collectionPath, ...pathSegments].join('/');
  const parts = fullPath.split('/');
  
  let ref: any = db;
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      ref = ref.collection(parts[i]);
    } else {
      ref = ref.doc(parts[i]);
    }
  }
  return ref;
};

/**
 * Get a collection reference
 */
export const collection = (firestoreInstance: any, collectionPath: string, ...pathSegments: string[]) => {
  const fullPath = [collectionPath, ...pathSegments].join('/');
  const parts = fullPath.split('/');
  
  let ref: any = db;
  for (const part of parts) {
    ref = ref.collection(part);
  }
  
  // Return the native collection reference directly
  // It already has all the methods (.add, .get, .where, etc.)
  return ref;
};

/**
 * Get a document
 */
export const getDoc = async (docRef: any) => {
  const snapshot = await docRef.get();
  return {
    exists: () => snapshot.exists,
    data: () => snapshot.data(),
    id: snapshot.id,
    ref: docRef,
  };
};

/**
 * Get multiple documents
 */
export const getDocs = async (queryRef: any | any) => {
  const snapshot = await queryRef.get();
  return {
    docs: snapshot.docs.map((doc: any) => ({
      exists: () => doc.exists,
      data: () => doc.data(),
      id: doc.id,
      ref: doc.ref,
    })),
    empty: snapshot.empty,
    size: snapshot.size,
  };
};

/**
 * Set a document (optimistic — returns once cached locally)
 */
export const setDoc = async (docRef: any, data: any, options?: { merge?: boolean }) => {
  const writePromise = options?.merge
    ? docRef.set(data, { merge: true })
    : docRef.set(data);
  await optimisticWrite(writePromise, `setDoc(${docRef.path || 'unknown'})`);
};

/**
 * Update a document (optimistic — returns once cached locally)
 */
export const updateDoc = async (docRef: any, data: any) => {
  await optimisticWrite(docRef.update(data), `updateDoc(${docRef.path || 'unknown'})`);
};

/**
 * Add a document to a collection (optimistic — returns once cached locally)
 * Pre-generates the document ID so we can return it immediately even if
 * the server ACK hasn't arrived yet.
 */
export const addDoc = async (collectionRef: any, data: any) => {
  try {
    // Pre-generate a document ID so we can return it immediately
    const docRef = collectionRef.doc();
    const writePromise = docRef.set(data);
    await optimisticWrite(writePromise, `addDoc(${collectionRef.path || 'unknown'})`);
    return { id: docRef.id };
  } catch (error) {
    console.error('[Firestore Compat] addDoc failed:', error);
    throw error;
  }
};

/**
 * Delete a document (optimistic — returns once cached locally)
 */
export const deleteDoc = async (docRef: any) => {
  await optimisticWrite(docRef.delete(), `deleteDoc(${docRef.path || 'unknown'})`);
};

/**
 * Create a query
 */
export const query = (collectionRef: any | any, ...queryConstraints: any[]) => {
  let q: any = collectionRef;
  
  for (const constraint of queryConstraints) {
    if (constraint.type === 'where') {
      q = q.where(constraint.field, constraint.operator, constraint.value);
    } else if (constraint.type === 'orderBy') {
      q = q.orderBy(constraint.field, constraint.direction);
    } else if (constraint.type === 'limit') {
      q = q.limit(constraint.value);
    } else if (constraint.type === 'startAfter') {
      q = q.startAfter(constraint.value);
    } else if (constraint.type === 'endBefore') {
      q = q.endBefore(constraint.value);
    }
  }
  
  return q;
};

/**
 * Where constraint
 */
export const where = (field: string, operator: any, value: any) => {
  return { type: 'where', field, operator, value };
};

/**
 * Order by constraint
 */
export const orderBy = (field: string, direction?: 'asc' | 'desc') => {
  return { type: 'orderBy', field, direction: direction || 'asc' };
};

/**
 * Limit constraint
 */
export const limit = (value: number) => {
  return { type: 'limit', value };
};

/**
 * Start after constraint
 */
export const startAfter = (value: any) => {
  return { type: 'startAfter', value };
};

/**
 * End before constraint
 */
export const endBefore = (value: any) => {
  return { type: 'endBefore', value };
};

/**
 * Timestamp
 */
export const Timestamp = firestore.Timestamp;

/**
 * FieldValue
 */
export const FieldValue = firestore.FieldValue;

/**
 * WriteBatch
 */
export const writeBatch = (firestoreInstance: any) => {
  const batch = db.batch();
  return {
    set: (docRef: any, data: any, options?: { merge?: boolean }) => {
      if (options?.merge) {
        batch.set(docRef, data, { merge: true });
      } else {
        batch.set(docRef, data);
      }
    },
    update: (docRef: any, data: any) => {
      batch.update(docRef, data);
    },
    delete: (docRef: any) => {
      batch.delete(docRef);
    },
    commit: () => optimisticWrite(batch.commit(), 'batch.commit'),
  };
};

/**
 * On snapshot listener
 */
export const onSnapshot = (
  reference: any | any,
  onNext: (snapshot: any) => void,
  onError?: (error: Error) => void
) => {
  return reference.onSnapshot(
    (snapshot: any) => {
      if ('docs' in snapshot) {
        // Query snapshot
        const docs = snapshot.docs.map((doc: any) => ({
          exists: () => doc.exists,
          data: () => doc.data(),
          id: doc.id,
          ref: doc.ref,
        }));
        onNext({
          docs,
          empty: snapshot.empty,
          size: snapshot.size,
          forEach: (callback: (doc: any) => void) => docs.forEach(callback),
        });
      } else {
        // Document snapshot
        onNext({
          exists: () => snapshot.exists,
          data: () => snapshot.data(),
          id: snapshot.id,
          ref: snapshot.ref,
        });
      }
    },
    onError
  );
};

// Field value helpers
export const arrayUnion = (...elements: any[]) => firestore.FieldValue.arrayUnion(...elements);
export const arrayRemove = (...elements: any[]) => firestore.FieldValue.arrayRemove(...elements);
export const serverTimestamp = () => firestore.FieldValue.serverTimestamp();
export const increment = (n: number) => firestore.FieldValue.increment(n);
export const deleteField = () => firestore.FieldValue.delete();

// Export type aliases
export type DocumentSnapshot = any;
export type QuerySnapshot = any;
export type Unsubscribe = () => void;
export type QueryConstraint = any;
