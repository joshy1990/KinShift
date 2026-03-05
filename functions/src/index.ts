/**
 * KinShift Cloud Functions — Server-Side Trust Layer
 *
 * These functions handle operations that MUST NOT run on the client:
 *  - Subscription tier changes (RevenueCat webhook)
 *  - Household join-code lookup (avoids broad Firestore list rules)
 *  - Push notification delivery (server-side Expo Push API)
 *  - Scheduled TTL cleanup (audit logs, security events)
 */

// Re-export all Cloud Function handlers
export { joinHouseholdByCode } from "./joinHousehold";
export { lookupInvitationByCode } from "./lookupInvitation";
export { revenueCatWebhook } from "./subscriptionWebhook";
export { sendPushNotification } from "./sendPush";
export { scheduledCleanup } from "./scheduledCleanup";
