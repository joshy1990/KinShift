/**
 * lookupInvitation Cloud Function
 *
 * Securely looks up an invitation by its invite code without exposing
 * the entire invitations collection to all authenticated users.
 *
 * Security:
 *  - Callable only by authenticated users.
 *  - Returns only the minimal fields the client needs.
 *  - Admin SDK read — bypasses Firestore rules.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

interface InvitationLookupResult {
  invitationId: string;
  householdId: string;
  householdName: string;
  invitedBy: string;
  status: string;
  expiresAt: string | null;
}

export const lookupInvitationByCode = functions.https.onCall(
  async (data: { inviteCode: string }, context): Promise<InvitationLookupResult> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const code = (data.inviteCode ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6,8}$/.test(code)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid invitation code format."
      );
    }

    // Look up invitation by code (Admin SDK)
    const snap = await db
      .collection("invitations")
      .where("inviteCode", "==", code)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (snap.empty) {
      throw new functions.https.HttpsError(
        "not-found",
        "No pending invitation found for this code."
      );
    }

    const doc = snap.docs[0];
    const inv = doc.data();

    // Check expiry
    if (inv.expiresAt) {
      const expiresAt = inv.expiresAt.toDate
        ? inv.expiresAt.toDate()
        : new Date(inv.expiresAt);
      if (expiresAt < new Date()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "This invitation has expired."
        );
      }
    }

    // Fetch household name
    let householdName = "Unknown Household";
    if (inv.householdId) {
      const hhDoc = await db.collection("households").doc(inv.householdId).get();
      if (hhDoc.exists) {
        householdName = hhDoc.data()?.name ?? householdName;
      }
    }

    return {
      invitationId: doc.id,
      householdId: inv.householdId,
      householdName,
      invitedBy: inv.invitedBy,
      status: inv.status,
      expiresAt: inv.expiresAt?.toDate?.().toISOString() ?? null,
    };
  }
);
