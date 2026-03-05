# KinShift — Pre-Release Security Audit Report
**Audit Date:** 2026-03-05  
**Auditor:** Release Manager  
**Target:** Public release readiness for high-adoption consumer market  
**Verdict:** 🔴 **NOT READY FOR RELEASE** — 3 Critical, 8 High severity findings must be resolved

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 3 |
| 🟠 HIGH | 8 |
| 🟡 MEDIUM | 16 |
| 🟢 LOW | 9 |
| ℹ️ INFO | 7 |
| **Total** | **43** |

### Release Blockers (Must fix before any public release)
1. **Any authenticated user can read/delete ALL audit logs and security events** — total evidence destruction
2. **Users can write their own subscription to premium** — free premium bypass for everyone
3. **Any user can list all households (leaks join codes, member lists) and read all invitations (leaks PII)**

---

## Audit Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Secrets & Credential Exposure | ✅ Complete |
| 2 | Firestore Security Rules | ✅ Complete |
| 3 | Authentication & Session Security | ✅ Complete |
| 4 | Input Validation & Injection | ✅ Complete |
| 5 | Dependency Vulnerability Scan | ✅ Complete |
| 6 | Production Configuration | ✅ Complete |
| 7 | Data Privacy & Retention | ✅ Complete |
| 8 | Error Handling & Logging | ✅ Complete |
| 9 | Platform Configs (Android/iOS) | ✅ Complete |
| 10 | Payment & Subscription Security | ✅ Complete |
| 11 | Network & Offline Security | ✅ Complete |
| 12 | RBAC & Authorization | ✅ Complete |

---

## Severity Legend
- 🔴 **CRITICAL** — Must fix before release. Security breach, data loss, or compliance violation.
- 🟠 **HIGH** — Should fix before release. Significant risk to users or business.
- 🟡 **MEDIUM** — Fix soon after release. Moderate risk or quality concern.
- 🟢 **LOW** — Nice to fix. Minor improvement or hardening.
- ℹ️ **INFO** — Observation. No action required but worth noting.

---

## Findings

---

### 🔴 CRITICAL Findings

---

#### C-1: Audit logs & security events readable/deletable by ANY authenticated user
**Files:** `firestore.rules` lines 221-237  
**Phase:** Firestore Security Rules

```
match /auditLogs/{logId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
  allow delete: if isAuthenticated();
}
match /securityEvents/{eventId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated();
  allow delete: if isAuthenticated();
}
```

**Issue:** Any authenticated user can read every audit log and security event in the system — including other users' sensitive actions — and can **delete any record**, destroying forensic evidence.

**Impact:** An attacker with any account can:
- Read all security activity across the entire app
- Cover tracks by deleting audit entries
- Read other users' action history (privacy violation)

**Recommendation:** 
- Move audit log / security event cleanup to a **Cloud Function** with admin SDK
- Firestore rules: `allow read: if false; allow create: if isAuthenticated(); allow delete: if false;`
- If client read is needed, scope to: `resource.data.userId == request.auth.uid`

---

#### C-2: Users can write their own subscription tier to premium
**Files:** `firestore.rules` lines 243-245, `src/services/subscription.service.ts`  
**Phase:** Payment & Subscription Security

```
match /subscriptions/{subscriptionId} {
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
  allow write: if isAuthenticated() && resource.data.userId == request.auth.uid;
}
```

**Issue:** A user can directly write `{tier: 'premium', status: 'active'}` to their subscription document using the Firestore SDK or REST API. There is no Cloud Function or server-side webhook validating RevenueCat purchase receipts.

**Impact:** Any user gets premium features for free. Subscription revenue = $0.

**Recommendation:**
- Change rule to: `allow read: if ...; allow write: if false;`
- All subscription tier changes must go through a **Cloud Function** that validates RevenueCat webhook receipts
- Implement RevenueCat server-to-server webhooks → Cloud Function → Firestore write

---

#### C-3: Any user can list ALL households — exposes join codes, member lists, names
**Files:** `firestore.rules` lines 56-57  
**Phase:** Firestore Security Rules

```
allow list: if isAuthenticated();
```

**Issue:** Any authenticated user can query the entire `households` collection. Response includes household names, join codes, member arrays, admin arrays, and settings. Combined with the public join mechanism, this enables:
- Reading any household's active join code
- Seeing all members of any household (privacy violation)
- Joining any household without an invitation

**Impact:** Complete household privacy bypass. Join codes provide zero protection.

**Recommendation:**
- Remove `allow list` or scope it: `allow list: if request.auth.uid in resource.data.members;`
- For join code lookup, use a **Cloud Function** that accepts a code and returns only the household name (not the full document)
- Store join codes in a separate collection with different access rules

---

### 🟠 HIGH Findings

---

#### H-1: Any user can read ALL invitations — leaks PII
**File:** `firestore.rules` line 168  
**Phase:** Firestore Security Rules

**Issue:** `allow read: if isAuthenticated()` on invitations lets any user read all pending invitations, including invitee email addresses, household names, and invite codes.

**Impact:** PII exposure (email addresses). Invitation hijacking — attacker reads invite code and accepts before intended recipient.

**Recommendation:** Scope to: `resource.data.invitedBy == request.auth.uid || resource.data.inviteeEmail == request.auth.token.email`

---

#### H-2: Any user can inject notifications into any other user's inbox
**File:** `firestore.rules` line 196  
**Phase:** Firestore Security Rules

**Issue:** `allow create: if isAuthenticated()` with no constraint on the `userId` field. Any user can write a notification targeting any other user.

**Impact:** Social engineering / phishing within the app. Fake "Shift Changed" or "Household Invitation" notifications.

**Recommendation:** Add Cloud Function for cross-user notifications, or add rule: `request.resource.data.createdBy == request.auth.uid && request.resource.data.userId in getUserHouseholdMembers()`

---

#### H-3: Push notifications sent from client via Expo Push API
**File:** `src/services/notification.service.ts` lines 348-432  
**Phase:** Network & Notification Security

**Issue:** `sendPushNotificationToUser()` calls `https://exp.host/--/api/v2/push/send` directly from the React Native client. The code itself has a `// SECURITY NOTE` acknowledging this should be server-side.

**Impact:** Combined with H-4, any user can send arbitrary push notifications to any device. Enables impersonation, spam, and phishing through push notifications.

**Recommendation:** Move push sending to a Cloud Function. Client requests notification → Cloud Function validates → sends via Expo Push API.

---

#### H-4: Push tokens readable by ALL authenticated users
**Files:** `src/utils/pushTokenManager.ts`, `firestore.rules` lines 41-44  
**Phase:** Firestore Security Rules

**Issue:** Push tokens are stored in user documents. The rule `allow read: if isAuthenticated()` on `/users/{userId}` means any user can read any other user's push tokens.

**Impact:** Combined with H-3, this completes a push notification compromise chain: read anyone's tokens → send arbitrary notifications.

**Recommendation:** 
- Store push tokens in a **subcollection** `users/{userId}/pushTokens/{tokenId}` with owner-only read
- OR move push token registration to a Cloud Function and remove tokens from the user document

---

#### H-5: Household join bypasses code validation in Firestore rules
**File:** `firestore.rules` lines 63-69  
**Phase:** Firestore Security Rules

**Issue:** The household update rule allows any authenticated user to add themselves to `members` if they modify only `members`, `memberJoinDates`, and `updatedAt`. **There is no rule-level check for a valid join code.** Join code validation is purely client-side.

**Impact:** A user who knows a household's document ID (exposed via C-3) can add themselves directly via Firestore SDK, bypassing code validation, expiry checks, and subscription member limits.

**Recommendation:** 
- Move household joining to a **Cloud Function** that validates the join code, checks expiry, and enforces subscription limits server-side
- Remove client-writable join path from Firestore rules

---

#### H-6: Sentry is disabled — no production error monitoring
**Files:** `app.config.js` lines 80-87, `src/config/sentry.config.ts`  
**Phase:** Error Handling

**Issue:** The Sentry Expo plugin is commented out in `app.config.js`. `SENTRY_DSN` is not configured. When DSN is empty, all `captureException`/`captureMessage` calls fall back to `console.error`, which is lost in production RN builds.

**Impact:** Production crashes, JS exceptions, and security events will be completely invisible. The app launches blind with no observability.

**Recommendation:** 
1. Create Sentry project and configure DSN via EAS secrets
2. Uncomment Sentry plugin in `app.config.js`
3. Verify source map uploads work in EAS builds

---

#### H-7: Client RBAC checks are not enforced server-side
**File:** `src/services/rbac.service.ts`  
**Phase:** RBAC & Authorization

**Issue:** Well-structured RBAC service with `enforceAdminOnly`, `enforceMemberOnly`, etc. However these are **client-side only**. Firestore rules diverge:
- Household update allows any user to self-add (bypassing RBAC)
- Notification create has no RBAC
- Audit log rules have no RBAC at all

**Impact:** An attacker bypassing the client (Firestore REST API or raw SDK) skips all RBAC checks.

**Recommendation:** Mirror critical RBAC checks in Firestore rules, or move protected operations behind Cloud Functions.

---

#### H-8: No rate limiting on auth operations (client-side)
**File:** `src/services/auth.service.ts`  
**Phase:** Auth & Session Security

**Issue:** No client-side rate limiting on signUp, signIn, or password reset. Firebase Auth has built-in server-side rate limiting (`auth/too-many-requests`), but the thresholds are undocumented and may not be strict enough for a high-adoption app.

**Impact:** Partially mitigated by Firebase's limits. Risk of enumeration attacks and credential stuffing at unknown thresholds.

**Recommendation:** Add exponential backoff in the client for failed attempts. Consider Firebase App Check for stronger protection.

---

### 🟡 MEDIUM Findings

---

#### M-1: Firebase API keys committed to git — verify GCP restrictions
**Files:** `google-services.json`, `GoogleService-Info.plist`  
**Issue:** Real Firebase API keys committed: `AIzaSyCJW6xjT-aHCk_cGAV9FIDemaoLJGN1Tro` (Android), `AIzaSyBN7qvfG1GqIPlz1f2y4scDsqDQCclPh4` (iOS). `.gitignore` has these intentionally un-ignored.  
**Action:** Verify API keys are restricted to bundle ID `com.kinshift.app` in GCP Console → APIs & Services → Credentials.

#### M-2: No server-side field-level validation in Firestore rules
**File:** `firestore.rules`  
**Issue:** No max length, type, or content checks on any fields. Client-side validation exists but can be bypassed.  
**Action:** Add `request.resource.data.title.size() < 200` style validations for critical string fields.

#### M-3: Day note content has no sanitization or length limit
**File:** `src/services/dayNote.service.ts` line 44-87  
**Issue:** `createNote()` writes `noteData.content` without calling `sanitize.text()` or checking length. Shift service does this, day note service does not.  
**Action:** Apply `sanitize.text(content, 2000)` before Firestore write.

#### M-4: No rate limit on invitation creation
**File:** `src/services/invitation.service.ts`  
**Issue:** Admin can create unlimited invitations for different emails. Could be abused for spam if email notifications are added.  
**Action:** Limit to N invitations per hour per household.

#### M-5: No server-side limit on household creation
**Files:** `firestore.rules` line 61, `src/services/household.service.ts`  
**Issue:** `allow create: if isAuthenticated()` allows unlimited households. Subscription limit is client-side only.  
**Action:** Move household creation to Cloud Function with subscription validation.

#### M-6: Account deletion misses audit logs and security events (GDPR)
**File:** `src/services/auth.service.ts` lines 188-413  
**Issue:** Thorough deletion of shifts, notes, patterns, notifications, messages, subscriptions. Does NOT delete audit logs or security events containing the user's ID.  
**Action:** Add cleanup of `auditLogs` and `securityEvents` where `userId == deletingUser.id`.

#### M-7: Push tokens not explicitly unregistered on account deletion
**File:** `src/services/auth.service.ts`  
**Issue:** User doc (containing pushTokens) is deleted, but tokens aren't explicitly unregistered from Expo Push service. Stale tokens may receive ghost notifications.  
**Action:** Call `unregisterPushToken()` for all tokens before deleting user doc.

#### M-8: No automated GDPR data export
**File:** `src/screens/profile/PrivacyPolicyScreen.tsx`  
**Issue:** Privacy policy says "Contact us to request a data export" — manual email handling only.  
**Action:** For high-adoption, implement automated data export in profile settings.

#### M-9: Privacy policy is self-described placeholder
**File:** `src/screens/profile/PrivacyPolicyScreen.tsx` lines 146-148  
**Issue:** Policy states: "For production use serving many users, consult a legal professional to ensure compliance with all applicable laws (GDPR, CCPA, etc.)"  
**Action:** Get legal review before public release.

#### M-10: Client-side push rate limit is trivially bypassable
**File:** `src/services/notification.service.ts` lines 358-375  
**Issue:** `pushRateLimit` Map is in-memory only. Resets on restart, irrelevant when bypassing client.  
**Action:** Move push sending to Cloud Function with server-side rate limiting.

#### M-11: Subscription limit checks fail-open
**File:** `src/services/subscription.service.ts` lines 312-320, 350-358  
**Issue:** `canAddHousehold()` and `canAddMember()` return `{allowed: true}` in catch blocks. Comments say "Fail-open: allow rather than block on transient errors."  
**Action:** Consider fail-closed for subscription checks. At minimum, log when failing open.

#### M-12: RevenueCat silently disabled without API key
**File:** `src/services/revenueCat.service.ts` lines 18-22  
**Issue:** Empty `REVENUECAT_API_KEY` means RevenueCat never initializes. App continues with client-writable Firestore-only subscription management.  
**Action:** Log a prominent warning. Consider making RevenueCat API key required for production builds.

#### M-13: Deep links don't verify auth state
**File:** `src/utils/deepLink.service.ts` lines 42-64  
**Issue:** `handleDeepLink` navigates to `InvitationAccept` without checking auth state. May be mitigated by navigation guards.  
**Action:** Add explicit `if (!currentUser)` check before navigation.

#### M-14: Offline queue stores unvalidated arbitrary data
**File:** `src/services/offlineEditQueue.service.ts` lines 43-72  
**Issue:** `data: any` stored in AsyncStorage. On replay, services re-validate, but the untyped payload could reach service methods with unexpected shapes.  
**Action:** Add schema validation before storing in the queue. Type the `data` field.

#### M-15: Password minimum is 6 characters (NIST recommends 8)
**Files:** `src/screens/auth/SignupScreen.tsx` line 64, `src/screens/profile/ChangePasswordScreen.tsx` line 45  
**Issue:** Client enforces `password.length < 6`. No complexity requirements. NIST SP 800-63b recommends minimum 8.  
**Action:** Increase to 8 characters minimum.

#### M-16: Android release build uses debug signing config
**File:** `android/app/build.gradle` lines 117-118  
**Issue:** `release { signingConfig signingConfigs.debug }` — the release build is signed with the debug keystore. Comment says "In production, you need to generate your own keystore file."  
**Action:** Generate a release keystore and configure it via EAS secrets before any store submission.

---

### 🟢 LOW Findings

---

#### L-1: Hardcoded EAS project ID fallback
**File:** `app.config.js` line 92  
**Issue:** `process.env.EAS_PROJECT_ID || "519ab785-c013-4ecb-b983-2354ae498ec4"` — real ID committed.  
**Action:** Remove fallback; require env var.

#### L-2: dayMessages missing explicit update rule
**File:** `firestore.rules` lines 155-163  
**Issue:** No `allow update` → implicitly denied. Intentional (messages immutable), but not explicit like shiftMessages. 
**Action:** Add `allow update: if false;` for clarity.

#### L-3: Email validation is very permissive
**File:** `src/utils/validation.ts` lines 20-21  
**Issue:** Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` accepts `a@b.c`. Length cap at 254 exists.  
**Action:** Consider stricter domain validation or send verification email.

#### L-4: No password breach-list check
**Issue:** No HaveIBeenPwned integration or password strength meter. Users can use `123456`.  
**Action:** Consider adding breach-check or strength meter in signup.

#### L-5: RBAC cache has 30-second staleness window
**File:** `src/services/rbac.service.ts` lines 55-56  
**Issue:** Demoted admin retains permissions for up to 30 seconds client-side. Mitigated by Firestore rules.  
**Action:** Acceptable. Reduce cache TTL if concerned.

#### L-6: Offline household/user sync not implemented
**File:** `src/services/offlineEditQueue.service.ts` lines 256-274  
**Issue:** `syncHouseholdEdit` and `syncUserEdit` silently fail with "not yet implemented".  
**Action:** Either implement or don't queue these operations. Remove silent failure.

#### L-7: Sentry sends email/name as PII
**File:** `src/config/sentry.config.ts` lines 109-114  
**Issue:** `setSentryUser(userId, email, name)` sends PII to Sentry when enabled.  
**Action:** Ensure Sentry DPA is in place. Consider sending only userId.

#### L-8: Excessive console.log/error statements in production code
**Files:** 60+ console.log/warn/error calls across services and screens  
**Issue:** In production React Native builds, console output goes to system logs. Some include contextual data like user IDs and error details.  
**Action:** Strip console statements in production builds using `babel-plugin-transform-remove-console` or route through telemetry service.

#### L-9: ProGuard/R8 minification disabled by default
**File:** `android/app/build.gradle` line 68  
**Issue:** `enableMinifyInReleaseBuilds = false` — no code minification or shrinking in release builds.  
**Action:** Enable for smaller APK size and basic code obfuscation.

---

### ℹ️ INFO Findings

---

#### I-1: No .env files committed — ✅ Good
#### I-2: ErrorBoundary hides stack traces in production — ✅ Good  
#### I-3: Re-authentication required for account delete and password change — ✅ Good
#### I-4: Firebase handles account lockout on repeated auth failures — ✅ Good
#### I-5: Shift ownership enforcement is comprehensive (service + rules + screens) — ✅ Good
#### I-6: Firestore offline persistence enabled with unlimited cache — ✅ Good
#### I-7: No email change functionality exists (can't be exploited) — ✅ Good

---

## Dependency Vulnerability Scan

**npm audit results:** 29 vulnerabilities (13 low, 4 moderate, 11 high, 1 critical)

| Package | Severity | Issue |
|---------|----------|-------|
| react-server-dom-webpack 19.0.0-19.0.3 | **CRITICAL** | RCE in React Server Components (GHSA-fv66) |
| node-forge ≤1.3.1 | HIGH | ASN.1 unbounded recursion, OID truncation |
| glob 10.2.0-10.4.5 | HIGH | Command injection via --cmd |
| serialize-javascript ≤7.0.2 | HIGH | RCE via RegExp.flags |
| tar ≤7.5.9 | HIGH | Multiple path traversal / symlink poisoning |
| minimatch ≤3.1.3 | HIGH | Multiple ReDoS (various CVEs) |
| lodash 4.0.0-4.17.21 | MODERATE | Prototype pollution in _.unset / _.omit |
| ajv <6.14.0 | MODERATE | ReDoS with $data option |
| js-yaml <3.14.2 | MODERATE | Prototype pollution in merge |
| undici <6.23.0 | MODERATE | Unbounded decompression chain |
| fast-xml-parser 5.0.0-5.3.7 | LOW | Stack overflow in XMLBuilder |
| @tootallnate/once <3.0.1 | LOW | Incorrect control flow scoping |
| webpack 5.49.0-5.104.0 | LOW | buildHttp allowedUris bypass (SSRF) |

**Note:** `react-server-dom-webpack` RCE is CRITICAL severity but is a transitive dev dependency — it's not used at runtime in a React Native app. Most HIGH findings are in dev/build tooling (jest, eslint, webpack). **`node-forge`** is the most concerning runtime-adjacent vulnerability.

**Action:** Run `npm audit fix` for safe auto-fixes. Review if `node-forge` is in the production bundle.

---

## Top 5 Actions Before Public Release

| Priority | Action | Findings Addressed |
|----------|--------|--------------------|
| 1 | **Lock down Firestore rules** — restrict auditLogs, securityEvents, households list, invitations read, notification create | C-1, C-3, H-1, H-2 |
| 2 | **Make subscriptions read-only from client** — Cloud Function for tier changes, validate RevenueCat receipts server-side | C-2 |
| 3 | **Move push notifications and household joining to Cloud Functions** — eliminate client-side trust for cross-user operations | H-3, H-4, H-5, H-7 |
| 4 | **Enable Sentry** — configure DSN, uncomment plugin, verify source maps | H-6 |
| 5 | **Legal review** — privacy policy, terms of service, GDPR data export | M-8, M-9 |

---

*End of audit — 2026-03-05*
