/**
 * sendPush Cloud Function
 *
 * Server-side push notification delivery via Expo Push API.
 * Replaces the client-side sendPushNotificationToUser function
 * that previously called exp.host directly from the device.
 *
 * Security:
 *  - Callable only by authenticated users.
 *  - Rate-limited: max 10 pushes/minute per caller.
 *  - Reads push tokens from Firestore (not from client input).
 *  - Push tokens are never exposed to the calling client.
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as https from "https";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const PUSH_RATE_LIMIT = 10;
const PUSH_RATE_WINDOW_MS = 60_000;
/**
 * NOTE: This in-memory map is per Cloud Function container instance
 * and is reset on cold starts. It is a best-effort rate limit, not a
 * hard guarantee. For strict rate limiting, migrate to Firestore-based
 * counters or Redis. The household membership check below still prevents
 * abuse from non-household members.
 */
const rateLimitMap = new Map<string, number[]>();

interface PushPayload {
  targetUserId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export const sendPushNotification = functions.https.onCall(
  async (payload: PushPayload, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const callerId = context.auth.uid;

    // Validate input
    const { targetUserId, title, body, data } = payload;
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Missing targetUserId.");
    }
    if (!title || typeof title !== "string" || title.length > 200) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid title.");
    }
    if (!body || typeof body !== "string" || body.length > 1000) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid body.");
    }

    // Rate limit per caller
    const now = Date.now();
    const history = rateLimitMap.get(callerId) ?? [];
    const recentSends = history.filter((t) => now - t < PUSH_RATE_WINDOW_MS);
    if (recentSends.length >= PUSH_RATE_LIMIT) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Push notification rate limit exceeded. Try again in a minute."
      );
    }
    rateLimitMap.set(callerId, [...recentSends, now]);

    // Verify caller and target share at least one household
    const callerHouseholds = await db
      .collection("households")
      .where("members", "array-contains", callerId)
      .get();
    const callerHouseholdMembers = new Set<string>();
    callerHouseholds.docs.forEach((d) => {
      (d.data().members ?? []).forEach((m: string) => callerHouseholdMembers.add(m));
    });
    if (!callerHouseholdMembers.has(targetUserId)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only send notifications to household members."
      );
    }

    // Look up target user's push tokens (Admin SDK — never sent to client)
    const userDoc = await db.collection("users").doc(targetUserId).get();
    if (!userDoc.exists) {
      return { sent: false, reason: "Target user not found." };
    }

    const tokens: string[] = userDoc.data()?.pushTokens ?? [];
    const validTokens = tokens.filter(
      (t) => t && typeof t === "string" && t.startsWith("ExponentPushToken")
    );

    if (validTokens.length === 0) {
      return { sent: false, reason: "No push tokens registered." };
    }

    // Build Expo Push messages
    const messages = validTokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: data ?? {},
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
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        }
      );
      req.on("error", reject);
      req.write(postBody);
      req.end();
    });

    // Parse Expo push response and check for errors
    let parsedResult: { data?: Array<{ status: string; id?: string; message?: string }> };
    try {
      parsedResult = JSON.parse(result);
    } catch {
      console.error("Failed to parse Expo push response:", result);
      return { sent: true, tokenCount: validTokens.length };
    }

    const tickets = parsedResult.data ?? [];
    const errors = tickets.filter((t) => t.status === "error");
    if (errors.length > 0) {
      console.warn(
        `Push to ${targetUserId}: ${errors.length}/${tickets.length} ticket(s) failed`,
        errors.map((e) => e.message)
      );
    }

    console.log(
      `Push sent to ${targetUserId} (${validTokens.length} token(s)) by ${callerId}`
    );

    return { sent: true, tokenCount: validTokens.length, errorCount: errors.length };
  }
);
