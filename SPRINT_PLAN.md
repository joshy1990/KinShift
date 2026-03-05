# KinShift — Release Readiness Sprint Plan
**Created:** 2026-03-05  
**Source:** Pre-Release Security Audit (RELEASE_AUDIT_TASKS.md)  
**Goal:** Resolve all Critical and High findings before public release  
**Total Findings:** 3 Critical, 8 High, 16 Medium, 9 Low

---

## Sprint Overview

| Sprint | Focus | Duration | Findings Covered | Exit Criteria |
|--------|-------|----------|------------------|---------------|
| **Sprint 1** | Firestore Rules Lockdown | 1 week | C-1, C-3, H-1, H-2, H-5, L-2 | All Firestore rules hardened, tested with rules emulator |
| **Sprint 2** | Cloud Functions & Server-Side Trust | 1.5 weeks | C-2, H-3, H-4, H-7, M-5, M-10, M-11, M-12 | Subscriptions, push, and join flows moved server-side |
| **Sprint 3** | Auth, Validation & Hardening | 1 week | H-8, M-2, M-3, M-4, M-13, M-14, M-15, L-3, L-4, L-6 | Input validation server+client, auth hardened |
| **Sprint 4** | Production Readiness & Compliance | 1 week | H-6, M-1, M-6, M-7, M-8, M-9, M-16, L-1, L-7, L-8, L-9 | Sentry live, legal reviewed, builds production-ready |

**Estimated total:** ~4.5 weeks

---

## Sprint 1 — Firestore Rules Lockdown
**Duration:** 1 week  
**Theme:** Eliminate all data exposure and evidence destruction vectors in Firestore rules  
**Owner:** Backend / Security Lead

### Stories

| # | Story | Finding | Priority | Est | Acceptance Criteria |
|---|-------|---------|----------|-----|---------------------|
| 1.1 | Lock down auditLogs — remove client read/delete | C-1 | 🔴 CRITICAL | 2h | `allow read: if false; allow create: if isAuthenticated(); allow delete: if false;` deployed. Client-side TTL cleanup removed or converted to call a Cloud Function. Existing audit.service.ts `getAuditLogs()` and `cleanupExpiredAuditLogs()` refactored — read goes via Cloud Function, delete goes via Cloud Function. |
| 1.2 | Lock down securityEvents — remove client read/delete | C-1 | 🔴 CRITICAL | 2h | Same pattern as 1.1. `allow read: if false; allow create: if isAuthenticated(); allow delete: if false;` |
| 1.3 | Scope household `list` to members only | C-3 | 🔴 CRITICAL | 4h | Change `allow list: if isAuthenticated()` → `allow list: if request.auth.uid in resource.data.members`. Verify `getUserHouseholds()` still works (it queries where user is in members — compatible). Join-code lookup must move to a Cloud Function (see 1.5). |
| 1.4 | Scope invitation `read` to involved parties | H-1 | 🟠 HIGH | 3h | `allow read: if resource.data.invitedBy == request.auth.uid \|\| resource.data.inviteeEmail == request.auth.token.email`. Verify invitation flows: create, accept, decline, cancel. |
| 1.5 | Create Cloud Function for join-code lookup | C-3, H-5 | 🔴 CRITICAL | 4h | `lookupJoinCode(code)` Cloud Function that validates code, checks expiry, returns only household name + ID. Remove client-side household query by join code. Update `household.service.ts` `joinHouseholdByCode()` to call function. |
| 1.6 | Restrict notification `create` to valid senders | H-2 | 🟠 HIGH | 3h | Add rule: `allow create: if isAuthenticated() && request.resource.data.createdBy == request.auth.uid`. OR move cross-user notification creation to a Cloud Function that validates the sender is in the same household as the recipient. |
| 1.7 | Add explicit `allow update: if false` to dayMessages | L-2 | 🟢 LOW | 15m | One-line rule addition for clarity. |
| 1.8 | Deploy & test rules with Firestore emulator | — | — | 4h | Write emulator tests covering all changed rules. Run `firebase emulators:start` and execute test suite. Verify no regressions in app flows. |

**Sprint 1 Total Estimate:** ~22 hours

### Definition of Done — Sprint 1
- [ ] All Firestore rules changes deployed to staging
- [ ] Emulator test suite covers every changed rule (positive + negative cases)
- [ ] Manual smoke test: create account → create household → join household → create shift → create note → send notification
- [ ] No user can read another user's audit logs, security events, or invitations via Firestore REST API
- [ ] Join-code lookup works only via Cloud Function

---

## Sprint 2 — Cloud Functions & Server-Side Trust
**Duration:** 1.5 weeks  
**Theme:** Move all cross-user and payment operations behind Cloud Functions  
**Owner:** Backend Lead + Payments Lead

### Stories

| # | Story | Finding | Priority | Est | Acceptance Criteria |
|---|-------|---------|----------|-----|---------------------|
| 2.1 | Create Cloud Function: `updateSubscriptionTier` | C-2 | 🔴 CRITICAL | 6h | Function receives RevenueCat webhook events. Validates receipt/entitlement. Writes to `subscriptions/{userId}` with admin SDK. Client Firestore rule changed to `allow write: if false`. |
| 2.2 | Integrate RevenueCat server-to-server webhooks | C-2 | 🔴 CRITICAL | 4h | Configure RevenueCat webhook URL → Cloud Function endpoint. Handle events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`. Test with RevenueCat sandbox. |
| 2.3 | Update subscription.service.ts for read-only client | C-2, M-11, M-12 | 🟠 HIGH | 3h | Remove all client-side `setDoc`/`updateDoc` calls on subscriptions. `getUserSubscription()` remains (read-only). Fail-open catches changed to fail-closed with user-facing error. Add warning log if RevenueCat API key is missing in production. |
| 2.4 | Create Cloud Function: `sendPushNotification` | H-3 | 🟠 HIGH | 5h | Callable function that accepts `{recipientUserId, title, body, data}`. Validates sender is in same household as recipient. Reads recipient push tokens server-side. Sends via Expo Push API. Rate limited (10/min/sender). |
| 2.5 | Move push tokens to private subcollection | H-4 | 🟠 HIGH | 4h | Migrate `pushTokens` from user doc to `users/{userId}/pushTokens/{tokenId}`. Rule: `allow read, write: if isOwner(userId)`. Update `pushTokenManager.ts` to use subcollection. Cloud Function reads tokens via admin SDK. |
| 2.6 | Update notification.service.ts to use Cloud Function | H-3, M-10 | 🟠 HIGH | 3h | Replace direct Expo Push API calls with callable Cloud Function invocation. Remove client-side `pushRateLimit` Map (server handles it). Keep Firestore notification document creation for in-app notifications. |
| 2.7 | Create Cloud Function: `joinHousehold` | H-5, M-5 | 🟠 HIGH | 5h | Callable function: validates join code + expiry, checks subscription member limits server-side, adds user to members array. Remove client-side household update for joining. Update Firestore rule to remove self-add path. |
| 2.8 | Create Cloud Function: `createHousehold` | M-5 | 🟡 MEDIUM | 3h | Validates subscription household limits server-side before creating. Update Firestore rule: `allow create: if false` (only via function). |
| 2.9 | Mirror critical RBAC checks in Cloud Functions | H-7 | 🟠 HIGH | 3h | All Cloud Functions (join, notification, subscription) enforce role checks via admin SDK reads of household doc. Document which RBAC checks are server-side vs client-side. |
| 2.10 | Deploy Cloud Functions to staging & integration test | — | — | 4h | End-to-end test: subscription purchase → webhook → tier update. Push notification via function. Household join via function. Verify old client paths are blocked. |

**Sprint 2 Total Estimate:** ~40 hours

### Definition of Done — Sprint 2
- [ ] Subscription document is read-only from client — write via Firestore SDK returns PERMISSION_DENIED
- [ ] RevenueCat webhook → Cloud Function → subscription update verified in sandbox
- [ ] Push notifications only sent via Cloud Function — direct Expo Push API calls removed
- [ ] Push tokens not readable by other users
- [ ] Household join only works via Cloud Function — direct Firestore member-array add returns PERMISSION_DENIED
- [ ] Household creation enforces subscription limits server-side
- [ ] All Cloud Functions have unit tests + integration tests

---

## Sprint 3 — Auth, Validation & Hardening
**Duration:** 1 week  
**Theme:** Input validation at the trust boundary, auth hardening, client-side robustness  
**Owner:** Full-Stack Dev

### Stories

| # | Story | Finding | Priority | Est | Acceptance Criteria |
|---|-------|---------|----------|-----|---------------------|
| 3.1 | Add Firestore rules field-level validation | M-2 | 🟡 MEDIUM | 4h | Rules validate: `title.size() <= 200`, `notes.size() <= 2000`, `content.size() <= 2000`, `name.size() <= 100`, `email.size() <= 254`. Applied to shifts, dayNotes, users, shiftMessages, dayMessages. |
| 3.2 | Add sanitization to dayNote.service.ts | M-3 | 🟡 MEDIUM | 1h | Call `sanitize.text(content, 2000)` before Firestore write in `createNote()` and `updateNote()`. Add unit test. |
| 3.3 | Add client-side auth rate limiting | H-8 | 🟠 HIGH | 3h | Implement exponential backoff: 1s → 2s → 4s → 8s → ... after each failed signIn/signUp attempt. Max 5 attempts then 60s cooldown. Persisted in memory (acceptable for client). Surface "Please wait X seconds" message to user. |
| 3.4 | Add rate limit on invitation creation | M-4 | 🟡 MEDIUM | 2h | Client-side: max 10 invitations per household per hour. Server-side: Cloud Function (or Firestore rule with timestamp check) enforces same limit. |
| 3.5 | Add auth state check to deep link handler | M-13 | 🟡 MEDIUM | 1h | In `handleDeepLink()`: if no authenticated user, store deep link URL and process after login. Update `RootNavigator` to check for pending deep link on auth state change. |
| 3.6 | Type the offline queue data field | M-14 | 🟡 MEDIUM | 2h | Replace `data: any` with a discriminated union: `ShiftCreateData \| ShiftUpdateData \| ShiftDeleteData`. Add Zod schema validation before `AsyncStorage.setItem()`. |
| 3.7 | Increase minimum password to 8 characters | M-15 | 🟡 MEDIUM | 1h | Update `SignupScreen.tsx` and `ChangePasswordScreen.tsx` validation: `password.length < 8`. Update error message. Add unit tests. |
| 3.8 | Improve email validation | L-3 | 🟢 LOW | 1h | Require at least 2-char TLD: `/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/`. Consider adding email verification flow post-signup. |
| 3.9 | Add password strength meter to signup | L-4 | 🟢 LOW | 3h | Integration with `zxcvbn` library for password strength scoring. Display strength bar (weak/fair/good/strong) below password field. Block passwords scoring 0 (extremely weak). |
| 3.10 | Remove silent failure in offline queue | L-6 | 🟢 LOW | 1h | `syncHouseholdEdit` / `syncUserEdit`: throw explicit error instead of returning `{error: 'not implemented'}`. Don't queue these operation types in `addToQueue()` — reject immediately. |

**Sprint 3 Total Estimate:** ~19 hours

### Definition of Done — Sprint 3
- [ ] Firestore rules reject documents with fields exceeding size limits
- [ ] All text inputs sanitized before Firestore write
- [ ] Auth screens show backoff timer after failed attempts
- [ ] Deep links queue for processing after authentication
- [ ] Offline queue rejects invalid payloads at queue time
- [ ] Password minimum is 8 characters with strength indicator
- [ ] All new logic has unit tests

---

## Sprint 4 — Production Readiness & Compliance
**Duration:** 1 week  
**Theme:** Observability, compliance, build config, and polish  
**Owner:** DevOps + Legal + Full-Stack Dev

### Stories

| # | Story | Finding | Priority | Est | Acceptance Criteria |
|---|-------|---------|----------|-----|---------------------|
| 4.1 | Enable Sentry error monitoring | H-6 | 🟠 HIGH | 3h | Create Sentry project. Add `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to EAS secrets. Uncomment Sentry plugin in `app.config.js`. Verify source map upload in a preview build. Trigger a test crash and confirm it appears in Sentry dashboard. |
| 4.2 | Restrict Firebase API keys in GCP Console | M-1 | 🟡 MEDIUM | 2h | Android key: restrict to `com.kinshift.app` package + SHA-256 fingerprint. iOS key: restrict to bundle ID `com.kinshift.app`. Verify app still authenticates after restriction. Document restrictions applied. |
| 4.3 | Clean up audit logs & security events on account deletion | M-6 | 🟡 MEDIUM | 2h | Add to `deleteAccount()` flow: query `auditLogs` where `userId == uid`, batch delete. Same for `securityEvents`. Add unit test. (Post Sprint 1, these are server-only — use Cloud Function for cleanup.) |
| 4.4 | Unregister push tokens on account deletion | M-7 | 🟡 MEDIUM | 1h | Before deleting user doc, iterate all push tokens and call `unregisterPushToken()` for each. Add to existing deletion cleanup chain. |
| 4.5 | Implement GDPR data export | M-8 | 🟡 MEDIUM | 6h | New screen: "Export My Data" in Profile settings. Cloud Function collects: user doc, shifts, dayNotes, customPatterns, notifications, messages, subscription. Returns JSON download. Privacy policy updated to reference automated export. |
| 4.6 | Legal review of Privacy Policy & Terms of Service | M-9 | 🟡 MEDIUM | — | **External:** Engage solicitor for UK/GDPR review. Remove placeholder disclaimer ("consult a legal professional"). Ensure GDPR Articles 13-14 (information), 15-20 (data subject rights), and 7 (consent) are covered. **No dev estimate — external dependency.** |
| 4.7 | Generate Android release keystore | M-16 | 🟡 MEDIUM | 2h | Generate keystore: `keytool -genkey -v -keystore kinshift-release.keystore`. Store securely (NOT in git). Add to EAS secrets. Update `build.gradle` release signingConfig to reference EAS-provided keystore. Verify signed APK/AAB. |
| 4.8 | Remove hardcoded EAS project ID fallback | L-1 | 🟢 LOW | 15m | Change `process.env.EAS_PROJECT_ID \|\| "519ab785..."` to just `process.env.EAS_PROJECT_ID`. Build will fail without env var — correct behavior. |
| 4.9 | Configure Sentry PII handling | L-7 | 🟢 LOW | 1h | Change `setSentryUser` to send only `userId` (remove email, name). Ensure Sentry project has "Prevent Storing of IP Addresses" enabled. Sign Sentry DPA if not already done. |
| 4.10 | Strip console statements in production builds | L-8 | 🟢 LOW | 1h | Add `babel-plugin-transform-remove-console` to `babel.config.js` for production builds. Verify no console.log appears in Hermes bundle. Keep `console.error` if needed or route through Sentry. |
| 4.11 | Enable ProGuard/R8 for release builds | L-9 | 🟢 LOW | 2h | Set `enableMinifyInReleaseBuilds = true` in `build.gradle`. Test release build locally. Fix any ProGuard rules issues (add keeprules for Firebase, React Native, etc.). Verify APK size reduction. |
| 4.12 | Run `npm audit fix` for dependency vulnerabilities | — | 🟡 MEDIUM | 2h | Run `npm audit fix`. For remaining issues, evaluate if vulnerable packages are in production bundle or dev-only. Pin / override critical packages. Document any accepted risks for dev-only dependencies. |
| 4.13 | Verify node-forge is not in production bundle | — | 🟡 MEDIUM | 1h | Trace `node-forge` dependency chain. If it's only in `firebase-admin` (dev/test), confirm it doesn't ship in the React Native bundle. If it does, find an alternative or upgrade. |

**Sprint 4 Total Estimate:** ~23 hours (excluding legal review)

### Definition of Done — Sprint 4
- [ ] Sentry dashboard receives test crash from preview build
- [ ] Firebase API keys restricted to app bundle IDs in GCP
- [ ] Account deletion removes all user data including audit logs and push tokens
- [ ] GDPR data export functional and accessible from profile
- [ ] Privacy policy and terms legally reviewed (or timeline confirmed with solicitor)
- [ ] Android release builds use production keystore
- [ ] `npm audit` shows 0 high/critical runtime vulnerabilities
- [ ] Console statements stripped from production bundles
- [ ] ProGuard enabled and release APK size verified

---

## Post-Sprint Backlog (Nice-to-have)

These items are not release blockers but should be scheduled after launch:

| # | Item | Finding | Est |
|---|------|---------|-----|
| B-1 | Add Firebase App Check for API abuse protection | H-8 | 4h |
| B-2 | Implement email verification flow post-signup | L-3 | 4h |
| B-3 | HaveIBeenPwned integration for password signup | L-4 | 3h |
| B-4 | Reduce RBAC cache TTL from 30s to 10s | L-5 | 15m |
| B-5 | Implement offline sync for household/user operations | L-6 | 8h |
| B-6 | Automated security scanning in CI (SAST) | — | 4h |
| B-7 | Firestore rules emulator tests in CI pipeline | — | 3h |
| B-8 | Penetration test engagement (external) | — | — |

---

## Resource Allocation

| Role | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|------|----------|----------|----------|----------|
| Backend / Security Lead | **Primary** | **Primary** | Support | Support |
| Full-Stack Dev | Support | Support | **Primary** | **Primary** |
| DevOps | — | Deploy support | — | **Primary** (builds, Sentry) |
| Payments Lead | — | **Co-lead** (2.1-2.3) | — | — |
| Legal / External | — | — | — | **Primary** (4.6) |
| QA | Rules testing (1.8) | Integration (2.10) | Unit tests | Release verification |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scoping household `list` rule breaks existing queries | Medium | High | Test with Firestore emulator before deploy. Fallback: use Cloud Function for all household queries. |
| RevenueCat webhook integration takes longer than estimated | Medium | High | Can launch with client-side subscription enforcement temporarily (accepted risk) if webhook is in progress. |
| Legal review delays Sprint 4 completion | High | Medium | Begin solicitor engagement in Sprint 1. Placeholder: add "under review" notice to policy screens. |
| Cloud Functions cold start affects UX | Low | Medium | Use `min_instances: 1` for critical functions (join, subscribe). Monitor latency. |
| ProGuard breaks runtime behavior | Medium | Low | Test thoroughly. Keep mapping files for crash symbolication. |

---

## Timeline Summary

```
Week 1          Week 2          Week 3          Week 4          Week 5
|── Sprint 1 ──|── Sprint 2 ────────────|── Sprint 3 ──|── Sprint 4 ──|
  Rules           Cloud Functions          Validation      Prod Ready
  Lockdown        Server-Side Trust        Hardening       Compliance
                                                           
  ↓ Rules         ↓ Subscriptions          ↓ All input     ↓ Sentry live
  hardened        server-validated         validated       ↓ Legal done
  ↓ Join code     ↓ Push server-side       ↓ Auth          ↓ Release
  via function    ↓ Join via function      hardened        keystore
```

**Target Release Date:** End of Week 5 (pending legal review completion)

---

*Sprint plan generated 2026-03-05 from audit findings.*
