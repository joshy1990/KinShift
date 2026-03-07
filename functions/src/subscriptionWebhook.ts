/**
 * RevenueCat Subscription Webhook
 *
 * Handles subscription lifecycle events from RevenueCat.
 * This is the ONLY path that can change the `tier` field on subscription
 * documents — client-side writes are blocked by Firestore rules.
 *
 * Security:
 *  - HTTPS endpoint, not a callable — RevenueCat posts directly.
 *  - Validates the shared webhook secret from environment config.
 *  - Writes via Admin SDK (bypasses Firestore rules).
 *
 * RevenueCat event types handled:
 *  - INITIAL_PURCHASE / RENEWAL → activate tier
 *  - CANCELLATION → mark canceled
 *  - EXPIRATION → downgrade to free
 *  - PRODUCT_CHANGE → upgrade/downgrade tier
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Map RevenueCat product IDs to KinShift tier names.
 * Update these when adding new products in RevenueCat.
 */
const PRODUCT_TO_TIER: Record<string, string> = {
  "kinshift_standard_monthly": "standard",
  "kinshift_standard_yearly": "standard",
  "kinshift_premium_monthly": "premium",
  "kinshift_premium_yearly": "premium",
};

export const revenueCatWebhook = functions.https.onRequest(
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // Validate webhook secret
    // Fail-closed: reject if secret is not configured or doesn't match
    const expectedSecret = functions.config().revenuecat?.webhook_secret;
    const authHeader = req.headers.authorization;
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      console.warn("RevenueCat webhook: invalid or missing authorization");
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      const event = req.body?.event;
      if (!event) {
        res.status(400).send("Missing event payload");
        return;
      }

      const {
        type,
        app_user_id: appUserId,
        product_id: productId,
        expiration_at_ms: expirationAtMs,
      } = event;

      if (!appUserId) {
        res.status(400).send("Missing app_user_id");
        return;
      }

      console.log(`RevenueCat event: ${type} for user ${appUserId}, product: ${productId}`);

      // Find the user's subscription document
      const subSnap = await db
        .collection("subscriptions")
        .where("userId", "==", appUserId)
        .limit(1)
        .get();

      if (subSnap.empty) {
        // Auto-create subscription doc for new users
        const now = new Date();
        await db.collection("subscriptions").add({
          userId: appUserId,
          tier: PRODUCT_TO_TIER[productId] ?? "free",
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: expirationAtMs
            ? new Date(expirationAtMs)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          createdAt: now,
          updatedAt: now,
        });
        res.status(200).json({ ok: true });
        return;
      }

      const subDoc = subSnap.docs[0];
      const now = new Date();

      switch (type) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "PRODUCT_CHANGE": {
          const newTier = PRODUCT_TO_TIER[productId];
          if (!newTier) {
            console.error(`Unknown product ID: ${productId}`);
            res.status(400).json({ error: `Unknown product ID: ${productId}` });
            return;
          }
          await subDoc.ref.update({
            tier: newTier,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: expirationAtMs
              ? new Date(expirationAtMs)
              : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: now,
          });
          break;
        }

        case "CANCELLATION": {
          await subDoc.ref.update({
            status: "canceled",
            canceledAt: now,
            updatedAt: now,
          });
          break;
        }

        case "EXPIRATION": {
          await subDoc.ref.update({
            tier: "free",
            status: "expired",
            updatedAt: now,
          });
          break;
        }

        default:
          console.log(`Unhandled RevenueCat event type: ${type}`);
      }

      // Audit log
      await db.collection("auditLogs").add({
        userId: appUserId,
        action: `subscription_${type.toLowerCase()}`,
        resourceType: "subscription",
        resourceId: subDoc.id,
        changes: { type, productId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("RevenueCat webhook error:", error);
      res.status(500).send("Internal Server Error");
    }
  }
);
