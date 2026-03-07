/**
 * joinHousehold Cloud Function
 *
 * Looks up a household by join code and adds the caller to its members array.
 * This replaces the client-side self-join bypass that was removed from
 * Firestore rules (previously allowed any user to add themselves to a
 * household's members array).
 *
 * Security:
 *  - Callable only by authenticated users (context.auth enforced).
 *  - Join code is validated server-side (length, format, expiry).
 *  - Subscription tier limit for member count is checked server-side.
 *  - Admin SDK writes bypass Firestore rules — no client trust needed.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** Max members hard cap (defence-in-depth) */
const ABSOLUTE_MAX_MEMBERS = 20;
/** Join code validity window in days (0 = no expiry) */
const JOIN_CODE_EXPIRY_DAYS = 30;

interface JoinResult {
  householdId: string;
  householdName: string;
}

export const joinHouseholdByCode = functions.https.onCall(
  async (data: { joinCode: string }, context): Promise<JoinResult> => {
    // 1. Auth guard
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to join a household."
      );
    }
    const userId = context.auth.uid;

    // 2. Input validation
    const joinCode = (data.joinCode ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6,8}$/.test(joinCode)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid join code format."
      );
    }

    // 3. Look up household by join code (Admin SDK — bypasses rules)
    const snap = await db
      .collection("households")
      .where("joinCode", "==", joinCode)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new functions.https.HttpsError("not-found", "Invalid join code.");
    }

    const householdRef = snap.docs[0].ref;
    const householdId = snap.docs[0].id;

    // Use a transaction to prevent race conditions where two users
    // join concurrently and both pass the member-count check.
    const householdName = await db.runTransaction(async (txn) => {
      const householdDoc = await txn.get(householdRef);
      if (!householdDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Household no longer exists.");
      }
      const household = householdDoc.data()!;

      // 4. Already a member?
      if ((household.members ?? []).includes(userId)) {
        throw new functions.https.HttpsError(
          "already-exists",
          "You are already a member of this household."
        );
      }

      // 5. Join code expiry check
      if (JOIN_CODE_EXPIRY_DAYS > 0 && household.joinCodeCreatedAt) {
        const created = household.joinCodeCreatedAt.toDate
          ? household.joinCodeCreatedAt.toDate()
          : new Date(household.joinCodeCreatedAt);
        const expiryMs = JOIN_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - created.getTime() > expiryMs) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "This join code has expired. Ask a household admin to regenerate it."
          );
        }
      }

      // 6. Member cap check (transactional — safe against concurrent joins)
      const currentCount = (household.members ?? []).length;
      if (currentCount >= ABSOLUTE_MAX_MEMBERS) {
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "This household has reached the maximum number of members."
        );
      }

      // 7. Subscription tier limit (read inside transaction for consistency)
      const creatorId = household.creatorId || (household.admins ?? [])[0];
      if (creatorId) {
        const subSnap = await txn.get(
          db.collection("subscriptions")
            .where("userId", "==", creatorId)
            .limit(1)
        );

        if (!subSnap.empty) {
          const sub = subSnap.docs[0].data();
          const tierLimits: Record<string, number> = {
            free: 2,
            standard: 6,
            premium: 20,
          };
          const maxMembers = tierLimits[sub.tier] ?? 2;
          if (currentCount >= maxMembers) {
            throw new functions.https.HttpsError(
              "resource-exhausted",
              `Member limit (${maxMembers}) reached for this household's subscription tier.`
            );
          }
        }
      }

      // 8. Add user to household (transactional write)
      const now = admin.firestore.FieldValue.serverTimestamp();
      txn.update(householdRef, {
        members: admin.firestore.FieldValue.arrayUnion(userId),
        [`memberJoinDates.${userId}`]: now,
        updatedAt: now,
      });

      return household.name ?? "Unnamed Household";
    });

    // 9. Audit log (outside transaction — non-critical)
    await db.collection("auditLogs").add({
      userId,
      action: "join_household",
      resourceType: "household",
      resourceId: householdId,
      changes: { joinCode },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      householdId,
      householdName,
    };
  }
);
