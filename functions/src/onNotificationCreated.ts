/**
 * onNotificationCreated Cloud Function
 *
 * Firestore trigger that fires when a new notification document is created.
 * Reads the target user's push tokens from the private subcollection
 * (users/{userId}/pushTokens) and delivers via Expo Push API.
 *
 * This replaces client-side push sending — tokens never leave the server.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as https from "https";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const onNotificationCreated = functions.firestore
  .document("notifications/{notificationId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const { userId, title, body, data: notifData } = data;

    if (!userId || !title || !body) {
      console.warn("Notification missing required fields:", snap.id);
      return;
    }

    // Read push tokens from the private subcollection (Admin SDK bypasses rules)
    const tokensSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("pushTokens")
      .get();

    // Also check legacy array field on user doc for tokens not yet migrated
    const userDoc = await db.collection("users").doc(userId).get();
    const legacyTokens: string[] = (userDoc.data()?.pushTokens ?? [])
      .map((t: any) => (typeof t === "string" ? t : t?.token))
      .filter((t: string | undefined) => !!t);

    const subcollectionTokens: string[] = tokensSnapshot.docs
      .map((d) => d.data()?.token)
      .filter((t: string | undefined) => !!t);

    // Deduplicate tokens from both sources
    const allTokens = [...new Set([...subcollectionTokens, ...legacyTokens])];
    const validTokens = allTokens.filter(
      (t) => t && typeof t === "string" && t.startsWith("ExponentPushToken")
    );

    if (validTokens.length === 0) {
      console.log(
        `No push tokens for user ${userId} — notification ${snap.id} saved to Firestore only.`
      );
      return;
    }

    // Build Expo Push messages
    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: notifData ?? {},
      badge: 1,
      priority: "high",
      channelId: "default",
    }));

    // Send via Expo Push API
    const postBody = JSON.stringify(messages);
    const result = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        {
          hostname: "exp.host",
          path: "/--/api/v2/push/send",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postBody),
          },
        },
        (res) => {
          let responseData = "";
          res.on("data", (chunk) => (responseData += chunk));
          res.on("end", () => resolve(responseData));
        }
      );
      req.on("error", reject);
      req.write(postBody);
      req.end();
    });

    let parsedResult: {
      data?: Array<{ status: string; id?: string; message?: string }>;
    };
    try {
      parsedResult = JSON.parse(result);
    } catch {
      console.error("Failed to parse Expo push response:", result);
      return;
    }

    const tickets = parsedResult.data ?? [];
    const errors = tickets.filter((t) => t.status === "error");
    if (errors.length > 0) {
      console.warn(
        `Push for notification ${snap.id}: ${errors.length}/${tickets.length} ticket(s) failed`,
        errors.map((e) => e.message)
      );
    }

    console.log(
      `Push delivered for notification ${snap.id} to user ${userId} (${validTokens.length} token(s))`
    );
  });
