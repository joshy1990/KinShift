/**
 * scheduledCleanup Cloud Function
 *
 * Runs daily via Cloud Scheduler to purge expired data across ALL users.
 * This replaces the client-side cross-user TTL cleanup that required
 * broad Firestore rules (any authenticated user could read/delete
 * any audit log or security event).
 *
 * Now: Firestore rules scope client access to own userId.
 * This function uses Admin SDK to perform the global sweep.
 *
 * Schedule: every day at 03:00 UTC
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/** TTL for audit logs — 90 days */
const AUDIT_LOG_TTL_DAYS = 90;
/** TTL for security events — 365 days */
const SECURITY_EVENT_TTL_DAYS = 365;
/** Max docs to delete per collection per run */
const BATCH_SIZE = 500;
const FIRESTORE_BATCH_LIMIT = 499;

async function purgeCollection(
  collectionName: string,
  ttlDays: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ttlDays);

  const snap = await db
    .collection(collectionName)
    .where("timestamp", "<", cutoffDate)
    .limit(BATCH_SIZE)
    .get();

  if (snap.empty) return 0;

  let deletedCount = 0;
  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = snap.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += chunk.length;
  }

  return deletedCount;
}

export const scheduledCleanup = functions.pubsub
  .schedule("every day 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    console.log("[ScheduledCleanup] Starting daily global TTL purge…");

    const [auditDeleted, securityDeleted] = await Promise.all([
      purgeCollection("auditLogs", AUDIT_LOG_TTL_DAYS),
      purgeCollection("securityEvents", SECURITY_EVENT_TTL_DAYS),
    ]);

    console.log(
      `[ScheduledCleanup] Done. Purged ${auditDeleted} audit logs, ${securityDeleted} security events.`
    );

    return null;
  });
