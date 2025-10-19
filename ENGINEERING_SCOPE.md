# LinkShift Engineering Scope (Launch + 90 Days)
Last updated: 2025-10-19

This document defines the engineering work to make LinkShift production-ready for app stores and to deliver a competitive 90-day roadmap. It translates product/market recommendations into concrete technical requirements, interfaces, acceptance criteria, QA, and rollout steps.

Note: All file paths refer to this repository. Types referenced are in `src/types/index.ts` unless otherwise stated.

---

## Goals and Non-Goals

Goals (P0 = must-have for store launch):
- P0: Push notifications (Expo Notifications) for critical events.
- P0: Subscription payments with entitlements (RevenueCat) and secure gating.
- P0: Household RBAC and subscription limits fully enforced; ability to leave household; join-code expiry.
- P0: Monetize Free tier with AdMob banners; remove for paying users per tier.
- P1: Calendar export/sync (ICS + Google/Apple flows), localization, onboarding templates, invite/referral loop, paywall polish.
- P2: Conflict detection, widgets/lock-screen surfaces, shareable schedule exports, crash/analytics instrumentation.

Non-Goals (initial launch):
- Complex web push notifications.
- Full-blown server backend beyond Firebase + Cloud Functions.
- Payment provider custom logic (use RevenueCat to de-risk and move fast).

---

## Environments and Config

- Expo SDK 54; Firebase Web SDK 12; React 19.
- Staging and Production projects in Firebase (separate configs under `src/config/firebase.config.*.ts`).
- RevenueCat apps for iOS/Android with products mapped to Free/Standard/Premium.
- AdMob apps with test and production ad unit IDs.
- EAS build profiles for staging/prod.

---

## P0 — Must Haves for Store Launch

### 1) Push Notifications (Expo Notifications)

Requirements:
- Request and store device push tokens per user and platform (Android/iOS).
- Send push/local notifications for:
  - Shift created/updated/deleted (to involved household members).
  - Invitation received/accepted.
  - Day note tagged to working members (optional toggle).
  - Upcoming shift reminder (configurable: e.g., 1 hour before).
- Foreground handler to show in-app banners/toasts; update `Notifications` badge count.

Architecture:
- Client: `expo-notifications` for permission + token registration; foreground/background handlers.
- Data: New collection `deviceTokens` or subcollection under `users/{userId}/devices` with fields: `token`, `platform`, `createdAt`, `updatedAt`, `appVersion`.
- Server: Firebase Cloud Functions (Node 18) watching Firestore events (`shifts`, `invitations`, `dayNotes`) to send push via Expo push API; optionally rate-limit.
- Local reminders: Client schedules local notifications for user-owned shifts if push is unavailable.

Tasks:
- Add dependency: `expo-notifications`.
- Implement `src/services/notification.service.ts` (replace stub) with:
  - `initialize(userId: string)` → registers token, sets handlers.
  - `checkPermission()` / `requestPermission()`.
  - `registerDeviceToken(userId: string)` → writes to Firestore.
  - `listenToUserNotifications(userId, cb)` → Firestore listener; update badge count in `MainTabNavigator`.
  - `scheduleLocalShiftReminder(shiftId, date)`.
- Cloud Functions (new folder `functions/`):
  - `onShiftWrite` → determine recipients; send push with payload.
  - `onInvitationWrite` → notify invitee and inviter.
  - `onDayNoteWrite` (optional in P0) → notify per settings.
- Permissions UX: First-run prompt with clear value; settings screen toggle in `NotificationPreferencesScreen`.

Acceptance Criteria:
- User who creates/updates a shift sees a reminder notification at configured time.
- Household members receive push on changes relevant to them (within 5–20s for RT events).
- Badge count increments for unread items in the `Notifications` tab and resets on open/read.
- Opt-in rate and delivery metrics visible in console logs (basic telemetry) and/or dashboard.

Testing:
- Unit: service methods for token registration and local scheduling.
- Integration: E2E on device (Android/iOS) using Expo dev client; verify push received and opens the app to correct screen.
- Edge: No duplicate notifications; token refresh on re-install; permission denied flow gracefully handled.

Risks:
- APNs/FCM provisioning complexity → mitigate by using Expo’s push service and following setup guides.

---

### 2) Payments & Entitlements (RevenueCat)

Requirements:
- Implement in-app purchases with RevenueCat to manage entitlements for `standard` and `premium` tiers; Free is default.
- Replace any client-side tier overrides; entitlements are the source of truth.
- Support 7–14 day trial (configurable in RevenueCat) and handle trial states in UI.

Architecture:
- Client: RevenueCat SDK integration. Observe PurchaserInfo/CustomerInfo to reflect entitlements.
- Server: Optional RevenueCat webhooks to Firestore if we need mirrored data; not required at MVP if client gates by entitlements.
- Data: Minimize custom subscription docs; keep `subscription.service.ts` for limits logic but read tier via entitlements.

Tasks:
- Add dependency: `react-native-purchases` (RevenueCat) with Expo config plugin if needed.
- Create `src/services/billing.service.ts` to encapsulate:
  - `initialize()` with API keys.
  - `getEntitlements()` → maps to `free|standard|premium`.
  - `purchaseTier(tier)` and `restorePurchases()`.
  - `onCustomerInfoUpdated(cb)` event.
- Update gating in:
  - `subscription.service.ts` → derive tier from entitlements; keep limit tables.
  - UI components (`UpgradePrompt`, paywall screens) to use RevenueCat offerings and introductory pricing if available.
- Security: Remove any code paths that set tier directly in Firestore; ensure Firestore rules prevent arbitrary writes to user subscription state.

Acceptance Criteria:
- Paywall shows live products/prices; purchasing unlocks correct features immediately across app.
- Trial states displayed (banner + countdown) and transitions to paid/expired correctly.
- Standard removes ads for admin; Premium removes ads for all users (per product definition).
- Restore purchases works on re-install.

Testing:
- Sandbox purchases on both platforms; verify entitlement mapping.
- Unit tests: tier gating logic; migration compatibility if Firestore doc exists but no entitlement.

Risks:
- Store review issues if trial messaging unclear → keep transparent and consistent; follow Apple/Google guidelines.

---

### 3) RBAC, Limits, and Security

Requirements:
- Enforce admin/member permissions consistently across services and screens.
- Implement "Leave household"; handle last-admin transfer/promotion flows.
- Enforce join-code expiry (`JOIN_CODE_EXPIRY_DAYS`) and regenerate logic.
- Enforce subscription-based member/household limits at the service layer and UI.
- Add/verify Firestore Security Rules to prevent unauthorized changes.

Tasks:
- Household service (`src/services/household.service.ts`):
  - Complete `canInviteMember`, `canRemoveMember`, `canManageRoles` checks with comprehensive role logic.
  - Add `leaveHousehold(householdId, userId)` and last-admin transfer logic.
  - Enforce `JOIN_CODE_EXPIRY_DAYS` on join.
  - Integrate `subscriptionService.canAddHousehold` and `canAddMember` server-side checks consistently.
- Shift service (`src/services/shift.service.ts`):
  - Ensure settings-aware `validateShiftPermissionWithSettings` paths cover all update/delete/approve flows.
  - Verify household settings (e.g., `requireApprovalForShifts`) are enforced consistently in CRUD.
- Firestore Rules (new `firestore.rules`):
  - Users can read themselves; limit writes to own profile.
  - Household writes restricted to admins; member joins via controlled endpoints only.
  - Shifts: owner or admin as per settings.
  - Subscriptions: read-only client; no client write to tiers.
- UI: add role-gated affordances (disable buttons with tooltip/explanation).

Acceptance Criteria:
- Non-admins cannot invite/remove/promote members; admins can; last admin cannot leave without transfer.
- Join codes older than expiry are rejected; regeneration path works.
- Member/household limits enforced with clear Upgrade prompt; soft-fail open paths removed.
- Adversarial attempts to write tiers in Firestore are blocked by rules.

Testing:
- Unit tests for every permission path.
- Integration tests with mocked Firebase to cover join/leave/invite flows and bad-path attempts.

Risks:
- Complex edge cases for last-admin transfer; cover with tests and explicit UX copy.

---

### 4) Ads Integration (AdMob)

Requirements:
- Show banner ads for Free users; Standard removes ads for admin (members still see), Premium removes ads for all.
- Respect privacy/consent and child-directed settings if relevant.

Tasks:
- Add `expo-ads-admob` and configure app/ad unit IDs.
- Replace `AdBanner` placeholder with real `AdMobBanner` when ads should display.
- Centralize ad gating via entitlements/tier logic (see Payments section).
- Add consent prompt on first launch (CMP integration if needed) and an opt-out where required.

Acceptance Criteria:
- Ads appear only for users who should see them based on tier; Premium never sees ads.
- No ads on sensitive screens (auth, checkout/paywall) and ensure layout stability when ad fails to load.
- Use test ad units in development.

Testing:
- Manual verification on device with test ad units; handle failures gracefully (fallback spacing only).

Risks:
- Store rejections for ad on paywall → avoid ads on purchase flows.

---

## P1 — Post-Launch ROI (Weeks 3–6)

### 5) Calendar Export/Sync

Requirements:
- ICS export for household/user calendar; one-tap add to Google/Apple.
- Optional private ICS feed URLs for auto-sync (tokenized, revocable).

Tasks:
- Serverless: Cloud Function endpoint `GET /ics/:entityType/:id?token=` generating ICS from Firestore.
- Client: `Profile` > `Calendar Export` screen to generate/revoke tokens; manage links; on-demand export file.
- Data: Store hashed tokens and last access time.

Acceptance Criteria:
- Users can export ICS and import to Google/Apple; entries match current shifts.
- Private feed remains valid until revoked; revocation takes effect within 5 minutes.

Testing:
- Validate ICS format with Google/Apple; timezone and recurrence correctness.

---

### 6) Localization & Regionalization

Requirements:
- Translate UI to top locales; support 12/24h time, week-start settings, currency by store.

Tasks:
- Add `i18next` (or `expo-localization` + simple map) with translation files.
- Localize copy in screens/components; centralize date formatting via `date-fns` locales.
- Hook RevenueCat localized pricing in paywall.

Acceptance Criteria:
- Device language switches UI; dates/times formatted correctly; GBP/locale pricing displayed.

Testing:
- Snapshot testing of major screens per locale; manual spot checks (ES, FR, DE, PT-BR, HI).

---

### 7) Onboarding Templates & Quick Add

Requirements:
- One-tap pattern templates (4-on-4-off, 2-2-3, 12h nights, etc.).
- Guided onboarding: create household, add members, set notifications.

Tasks:
- Library of templates in `src/utils/shiftPatterns.ts` (exists) with UX for selection.
- Onboarding screens to configure pattern start date and auto-generate shifts (batch operation with confirmation).

Acceptance Criteria:
- New users can set a pattern in <60 seconds; shifts appear correctly.

Testing:
- Batch performance and rollback on partial failures; ensure duplicates avoided.

---

### 8) Invites & Referrals

Requirements:
- Streamlined invites: contact picker, QR code for join code, share sheet.
- Referral program: both get +7 days Premium when invitee creates first shift.

Tasks:
- Extend invite generation to include `referrerId`.
- Track referral events in Firestore and grant promotional entitlements (via RevenueCat promo or internal trial extension).

Acceptance Criteria:
- Invite flows convert; referral bonus applied once per pair; abuse limited by basic checks.

Testing:
- End-to-end invite acceptance; referral reward attribution; revoke on fraud.

---

### 9) Paywall/Messaging Polish

Requirements:
- Transparent benefits list; dynamic pricing; contextual upgrade prompts on limit hits.

Tasks:
- Update `PlanComparisonScreen` with RevenueCat offerings and localized features.
- Add contextual `UpgradePrompt` triggers and track funnel metrics.

Acceptance Criteria:
- Higher trial start rate vs. baseline; no misleading claims.

Testing:
- A/B test copy variants (simple local experimentation or remote config).

---

## P2 — Differentiators (Weeks 7–12)

### 10) Smart Conflict Detection

Requirements:
- Detect overlapping shifts and childcare conflicts; daily summary of coverage.

Tasks:
- Background job (Cloud Function) or client-side on changes to compute conflicts per household/day and write to `conflicts` collection.
- UI surface: Day view shows conflicts and quick actions.

Acceptance Criteria:
- Conflicts identified within seconds; false positives low; dismiss/resolution tracked.

Testing:
- Synthetic datasets covering overlapping/edge cases and timezones.

---

### 11) Widgets & Lock Screen

Requirements:
- Next shift widget and today’s schedule glance (platform capabilities permitting).

Tasks:
- iOS/Android widget setup (note: may require EAS plugins/native config beyond Expo managed; plan feasibility).
- In-app setting to enable/disable.

Acceptance Criteria:
- Widget displays up-to-date next shift; tapping opens the relevant screen.

Risks:
- Expo limitations; may require modularization or Expo Router updates.

---

### 12) Shareable Schedule (Image/PDF)

Requirements:
- Generate an image/PDF of two-week schedule for sharing.

Tasks:
- Render offscreen component and snapshot (Expo `captureRef`) or server-generated PDF.
- Share sheet integration.

Acceptance Criteria:
- Export looks crisp on mobile and printable on A4; handles dark/light themes.

---

### 13) Observability (Crash/Analytics)

Requirements:
- Crash reporting (Sentry) and analytics funnels (Amplitude/Segment) with privacy controls.

Tasks:
- Integrate Sentry for React Native with release mapping.
- Add key analytics events (activation, invite sent/accepted, paywall view/buy, notification delivered/clicked, export used).
- Settings toggle and privacy page update.

Acceptance Criteria:
- Crash-free sessions > 99%; core funnels visible in dashboard.

---

## Data Model and APIs

New/updated collections:
- `users/{userId}/devices/{deviceId}`: `{ token, platform, createdAt, updatedAt, appVersion }`.
- `notifications` (existing types): ensure `read` field and indexing on `userId, createdAt`.
- `icsTokens`: `{ entityType: 'user'|'household', entityId, tokenHash, createdAt, revokedAt? }`.
- `conflicts` (P2): `{ householdId, date, shifts[], users[], conflictType, detectedAt, resolvedAt?, resolvedBy? }`.

API Surface (selected):
- Notification service: `initialize`, `registerDeviceToken`, `scheduleLocalShiftReminder`, `listenToUserNotifications`, `markAsRead`, `markAllAsRead`.
- Billing service: `initialize`, `getEntitlements`, `purchaseTier`, `restorePurchases`, `onCustomerInfoUpdated`.
- Household service: `leaveHousehold`, `promoteMember`, `demoteMember`, updated `can*` checks.
- ICS function: `GET /ics/:type/:id?token=...` returns `text/calendar`.

Security Rules (high level):
- Users: read self; limited write to own doc; no privilege escalation.
- Households: write restricted to admins; joins controlled; audit changes.
- Shifts: owner/admin per settings; deny cross-user edits.
- Subscriptions: read-only from client; entitlements via RevenueCat only.
- ICS tokens: only owners/admins can create/revoke; read never exposed (only hashed server-side).

---

## Acceptance Criteria Summary (per Workstream)

- Notifications: Tokens stored; events delivered; badges update; local fallback; opt-in UX.
- Payments: Live products; entitlements gate features; restore works; test purchases pass; no Firestore tier writes from client.
- RBAC: All permission checks covered; last-admin transfer logic; join code expiry enforced; limits enforced server-side.
- Ads: Correct gating; test units in dev; no ads on paywall/auth; layout stable.
- ICS: Valid imports to Google/Apple; tokenized feeds revocable; timezone correctness.
- Localization: Major screens translated; date/time/currency correct; pricing localized.
- Templates: 4-on-4-off and others one-tap; batch creation safe; undo path clear.
- Invites/Referrals: Share flows; referral reward issued correctly.
- Paywall: Clear, localized, dynamic offerings.
- Conflicts: Accurate detection; UI surfaces; resolution tracked.
- Widgets: Working test widget; opens app to context (feasibility gated).
- Sharing: High-quality exports; easy sharing.
- Observability: Sentry integrated; funnels tracked.

---

## QA Strategy

- Unit tests: Expand `src/services/tests/` to cover permission checks, subscription gating, and notification scheduling.
- Integration tests: Firebase emulator for Firestore rules and cloud functions; simulate household/shift flows.
- E2E tests (select): Detox/Maestro for smoke tests on auth → calendar → add shift → notification permission → purchase.
- Performance checks: Use `performanceMonitor` utilities; target startup < 2s; batch create < 5s.
- Manual device matrix: 2 Android + 2 iOS models; at least 1 low-end Android.

---

## Rollout Plan

- Feature flags: `config` object with booleans (Notifications, Ads, RevenueCat, ICS) defaulted per environment.
- Staging release (Internal/TestFlight) → 1 week soak with Crash/Analytics enabled.
- Phased production rollout: start 10%, monitor crashes and purchase errors, then ramp to 100%.
- Store listings: localized metadata, screenshots, and privacy labels.

---

## Timeline & Resourcing (Indicative)

- Weeks 0–2 (P0): Notifications (4–5 d), RevenueCat (3–4 d), RBAC & Rules (3–4 d), AdMob (1–2 d), QA + review (3–4 d).
- Weeks 3–6 (P1): ICS export (4 d), Localization phase 1 (5 d), Templates & onboarding (3 d), Invites/referrals (4 d), Paywall polish (2 d).
- Weeks 7–12 (P2): Conflict detection (5 d), Widgets (spike 2 d + build 5 d), Sharing (3 d), Observability (2 d), polish (ongoing).

Assumes 2–3 engineers and shared QA.

---

## Dependencies & Accounts

- Expo Notifications: Configure push credentials; test on physical devices.
- RevenueCat: Create app, products, entitlements; set trial.
- AdMob: Create app + banner unit IDs; test IDs in dev.
- Firebase: Enable Cloud Functions; set billing if needed for outbound calls; define indexes.
- App Store/Play Store: App records, signing, privacy forms.

---

## Risks & Mitigations

- Push provisioning complexity → follow Expo guides; start Android first if needed.
- Store review/paywall compliance → clear, honest messaging and localized pricing.
- Security edge cases → thorough Firestore rules + emulator tests; no client-writable tiers.
- Expo limitations for widgets → timebox spike; consider alternatives if blocked.

---

## Implementation Notes (Per File/Area)

- `src/services/notification.service.ts`: Replace stub with Expo Notifications implementation; preserve method signatures used by `MainTabNavigator`.
- `src/navigation/MainTabNavigator.tsx`: Ensure tab badge uses real unread count; update to handle foreground notifications and mark-as-read flows.
- `src/services/subscription.service.ts`: Read tier from entitlements; keep limits; remove direct write paths; update plan comparison UI.
- `src/components/AdBanner.tsx`: Swap placeholder with AdMob banner component gated by entitlements.
- `src/services/household.service.ts` and `src/services/shift.service.ts`: Complete permission checks; add `leaveHousehold`; enforce join-code expiry; add tests.
- `firestore.rules`: Add or update rules; include tests under emulator.
- `functions/` (new): Implement triggers and ICS endpoint.

---

## Definition of Done

- All P0 ACs pass on physical devices; Crash-free sessions > 99%; purchase and restore flows verified.
- Firestore rules deployed and tested via emulator; no client path allows unauthorized subscription changes.
- Store-ready builds produced; screenshots/video prepared; privacy labels complete.
- Monitoring in place (basic logs for P0, Sentry added by P2); runbooks noted for push/purchase incidents.

---

Appendix:
- Event taxonomy (initial): `auth_login`, `household_created`, `invite_sent`, `invite_accepted`, `shift_created`, `shift_updated`, `notification_delivered`, `notification_opened`, `paywall_viewed`, `purchase_started`, `purchase_completed`, `export_ics_used`.
- Indexes: Ensure queries on `notifications(userId, createdAt)`, `shifts(householdId, ownerId, isDeleted)` as per service usage.
