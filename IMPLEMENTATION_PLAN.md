# LinkShift Implementation Plan
**Date:** October 19, 2025  
**Status:** Pre-Launch Development - Custom Pattern System Complete  
**Team Size:** 2-3 Engineers + QA  
**Timeline:** 12 Weeks (3 Phases)

---

## Recent Completions (October 2025)

### ✅ Custom Pattern System Overhaul
**Status:** Complete and functional  
**Duration:** ~2 weeks  
**Impact:** Core feature for shift scheduling

#### Completed Work:
1. **Weekly Pattern Mode**
   - Fixed calendar day alignment (Monday cell → Monday shifts)
   - Implemented day-of-week mapping regardless of start date
   - Pattern always maps to calendar days (Mon-Sun)
   - Location: `customPattern.service.ts` lines 296-320

2. **Repetition Pattern Mode**
   - Implemented cycle-based logic (4on/4off, 2-2-3, etc.)
   - Pattern starts from cell[0] on chosen date
   - Auto-detects cycle length and repeats correctly
   - Fixed off-by-one error in first shift generation
   - Location: `customPattern.service.ts`, `AddShiftScreen.tsx` lines 625-705

3. **Pattern Builder UI Enhancement**
   - Auto-navigation: Save pattern → return to AddShift → auto-select
   - Pattern pre-selection via navigation params
   - Location: `PatternBuilderScreen.tsx` lines 156-170, `AddShiftScreen.tsx` lines 173-183

4. **Shift Type Picker Improvements**
   - Reduced to 3 quick-access types: Day, Night, Twilight
   - Added "More" button for remaining 6 types (Split, Holiday, Off, Sick, Training, Custom)
   - Removed single-letter labels, show full names
   - Location: `ShiftTypePicker.tsx`, `shiftTypeHelpers.ts` lines 74-82

5. **Date Field Logic**
   - Hidden when custom pattern selected (pattern determines dates)
   - Visible for manual shifts and built-in patterns
   - Condition: `(!usePattern || !selectedCustomPattern)`
   - Location: `AddShiftScreen.tsx` lines 1020-1033

6. **Pattern Toggle Behavior**
   - Turning off toggle clears custom pattern selection
   - Date field reappears when toggle off
   - Returns to manual shift creation mode
   - Location: `AddShiftScreen.tsx` lines 1287-1299

7. **Clear All Shifts Enhancement**
   - Pagination support for unlimited shift counts
   - Fetches 500 shifts per batch until complete
   - Prevents Firestore query limits
   - Location: `ProfileScreen.tsx` lines 76-126

#### Technical Details:
- **Pattern Start Calculation:** System finds first working day in pattern, advances clicked date to next occurrence of that day-of-week, then uses that as pattern start reference
- **Weekly vs Repetition Logic:** Completely separated in both service and screen layers
- **Cycle Detection:** Automatic cycle length detection for repetition patterns (supports any cycle length)
- **TypeScript Fixes:** Resolved type casting issues in ShiftTypePicker

#### Testing Status:
- ✅ Weekly patterns tested: Monday cell shows Monday shifts
- ✅ Repetition patterns tested: 4on/4off starts correctly
- ✅ First shift no longer missing
- ✅ Date field shows/hides correctly
- ✅ Pattern toggle clears selection
- ⏳ Comprehensive testing across multiple start dates pending

---

## Executive Summary

This implementation plan translates the ENGINEERING_SCOPE.md into actionable tasks for the engineering team. Work is organized into three phases aligned with product priorities:

- **Phase 1 (Weeks 0-2): P0 - Store Launch Readiness**
- **Phase 2 (Weeks 3-6): P1 - Post-Launch ROI Features**
- **Phase 3 (Weeks 7-12): P2 - Competitive Differentiators**

---

## Team Roles & Responsibilities

### Lead Developer (You)
- Architecture decisions and technical design reviews
- Critical path monitoring and risk mitigation
- Code reviews for security and payments
- Sprint planning and stakeholder communication

### Frontend Engineer
- React Native component implementation
- UI/UX polish and responsive design
- Client-side service integration
- Component and integration testing

### Backend Engineer
- Firebase Cloud Functions implementation
- Firestore data model and security rules
- Third-party API integrations (RevenueCat, Expo Push)
- Performance optimization

### QA Engineer (Shared/Part-time)
- Test plan creation and execution
- Device matrix testing (Android/iOS)
- Bug tracking and regression testing
- Store submission validation

---

## Phase 1: P0 - Store Launch Readiness (Weeks 0-2)

### Critical Success Criteria
- ✅ Push notifications working end-to-end
- ✅ Payment flow with RevenueCat functional
- ✅ RBAC and security rules enforced
- ✅ Ads showing for free tier, hidden for paid
- ✅ Zero P0 bugs on physical devices
- ✅ Crash-free sessions > 99%

---

### Workstream 1: Push Notifications (5 days)

#### 1.1 Client Setup & Infrastructure (2 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Install `expo-notifications` dependency
- Configure push credentials for iOS (APNs) and Android (FCM)
- Set up Expo dev client for testing
- Create `src/services/notification.service.ts` with base structure

**Acceptance Criteria:**
- Package installed and configured in app.json
- Push credentials verified in Expo dashboard
- Service file exports required interface methods

**Dependencies:** None (can start immediately)

---

#### 1.2 Token Registration & Management (1.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Implement `checkPermission()` and `requestPermission()`
- Implement `registerDeviceToken(userId)` to write to Firestore
- Create Firestore collection `users/{userId}/devices/{deviceId}`
- Add token refresh logic on app initialization
- Handle permission denied gracefully

**Acceptance Criteria:**
- Tokens stored in Firestore with platform, createdAt, updatedAt
- Duplicate tokens prevented
- Permission prompt shows clear value proposition

**Dependencies:** 1.1 complete

---

#### 1.3 Foreground & Background Handlers (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Implement foreground notification handler (in-app banner/toast)
- Implement background notification handler
- Implement notification tap handler (deep linking to relevant screen)
- Update `MainTabNavigator.tsx` badge count from `notifications` collection

**Acceptance Criteria:**
- Foreground notifications show as in-app toast
- Tapping notification opens correct screen with context
- Badge count updates in real-time

**Dependencies:** 1.2 complete

---

#### 1.4 Cloud Functions - Notification Triggers (2 days)
**Owner:** Backend Engineer  
**Tasks:**
- Create `functions/` directory with Node 18 setup
- Implement `onShiftWrite` trigger → send push to household members
- Implement `onInvitationWrite` trigger → notify invitee and inviter
- Implement rate limiting to prevent spam
- Use Expo push API for sending notifications

**Acceptance Criteria:**
- Shift create/update/delete triggers push within 5-20 seconds
- Invitation events trigger notifications
- Rate limiting prevents > 10 notifications per user per minute
- Logs include delivery status

**Dependencies:** 1.2 complete (needs device tokens in Firestore)

---

#### 1.5 Local Reminders & Settings (0.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Implement `scheduleLocalShiftReminder(shiftId, date)`
- Add notification preferences to `NotificationPreferencesScreen`
- Add toggles: shift reminders, invitation alerts, day notes

**Acceptance Criteria:**
- Users can schedule reminders (e.g., 1 hour before shift)
- Preferences persist and are respected
- Local notifications fire even when offline

**Dependencies:** 1.3 complete

---

### Workstream 2: Payments & Entitlements (4 days)

#### 2.1 RevenueCat Setup & Configuration (1 day)
**Owner:** Backend Engineer  
**Tasks:**
- Create RevenueCat projects for iOS and Android
- Configure products: Free (default), Standard, Premium
- Set up 7-day trial for Standard and Premium
- Generate API keys for staging and production
- Document product identifiers

**Acceptance Criteria:**
- Products visible in RevenueCat dashboard
- Trial configuration verified
- API keys stored securely in environment config

**Dependencies:** None

---

#### 2.2 Client SDK Integration (1.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Install `react-native-purchases` with Expo config plugin
- Create `src/services/billing.service.ts`
- Implement `initialize()` with API keys
- Implement `getEntitlements()` → maps to free|standard|premium
- Implement `purchaseTier(tier)` and `restorePurchases()`
- Add `onCustomerInfoUpdated(cb)` event listener

**Acceptance Criteria:**
- SDK initialized on app start
- Entitlements fetched and mapped correctly
- Purchase flow works in sandbox mode
- Restore purchases functional

**Dependencies:** 2.1 complete

---

#### 2.3 Feature Gating & Security (1 day)
**Owner:** Frontend + Backend Engineers  
**Tasks:**
- Update `subscription.service.ts` to read tier from entitlements
- Remove all client-side tier override code
- Update Firestore rules to prevent subscription writes from client
- Gate features by entitlement throughout app

**Acceptance Criteria:**
- Tier derived exclusively from RevenueCat entitlements
- No code path allows direct Firestore tier writes
- Security rules tested in emulator
- Feature access reflects entitlement immediately

**Dependencies:** 2.2 complete

---

#### 2.4 Paywall UI Updates (0.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Update `SubscriptionComponents.tsx` to use RevenueCat offerings
- Display localized pricing and introductory offers
- Add trial state banner (countdown)
- Update `UpgradePrompt.tsx` to reflect real products

**Acceptance Criteria:**
- Paywall shows live prices from App Store/Play Store
- Trial states clearly communicated
- Purchase buttons functional
- Loading and error states handled

**Dependencies:** 2.2 complete

---

### Workstream 3: RBAC, Limits & Security (4 days)

#### 3.1 Household Permission Checks (1.5 days)
**Owner:** Backend Engineer  
**Tasks:**
- Complete `canInviteMember` in `household.service.ts`
- Complete `canRemoveMember` with admin checks
- Complete `canManageRoles` with role logic
- Implement last-admin protection (cannot leave/demote without transfer)
- Add comprehensive unit tests

**Acceptance Criteria:**
- All permission methods return correct boolean for role combinations
- Last admin cannot leave without promoting another member
- Edge cases covered (single-member household, etc.)
- 100% test coverage for permission methods

**Dependencies:** None

---

#### 3.2 Leave Household & Role Management (1 day)
**Owner:** Backend Engineer  
**Tasks:**
- Implement `leaveHousehold(householdId, userId)`
- Implement `promoteMember(householdId, userId)`
- Implement `demoteMember(householdId, userId)`
- Handle cleanup of user data when leaving
- Add UI for these actions in household settings

**Acceptance Criteria:**
- Members can leave household (cleans up shifts, notifications)
- Admin promotion/demotion works
- Last admin transfer flow prompts for selection
- Atomic operations prevent race conditions

**Dependencies:** 3.1 complete

---

#### 3.3 Join Code Expiry & Limits Enforcement (1 day)
**Owner:** Backend Engineer  
**Tasks:**
- Enforce `JOIN_CODE_EXPIRY_DAYS` in join logic
- Add join code regeneration method
- Integrate `subscriptionService.canAddHousehold` server-side
- Integrate `subscriptionService.canAddMember` server-side
- Add clear error messages for limit violations

**Acceptance Criteria:**
- Join codes older than expiry days are rejected
- Regeneration creates new code and invalidates old
- Household and member limits enforced before operations
- Upgrade prompts shown when limits hit

**Dependencies:** 2.3 complete (needs entitlement-based limits)

---

#### 3.4 Firestore Security Rules (0.5 days)
**Owner:** Backend Engineer  
**Tasks:**
- Create/update `firestore.rules`
- Users: read self, limited writes
- Households: write restricted to admins
- Shifts: owner/admin per settings
- Subscriptions: read-only from client
- Test rules with Firebase emulator

**Acceptance Criteria:**
- All collections have appropriate rules
- Emulator tests pass for authorized and unauthorized attempts
- Rules deployed to staging and production

**Dependencies:** 3.1-3.3 complete (rules reflect service logic)

---

### Workstream 4: Ads Integration (1.5 days)

#### 4.1 AdMob Setup (0.5 days)
**Owner:** Backend Engineer  
**Tasks:**
- Create AdMob account and apps for iOS/Android
- Generate banner ad unit IDs for production
- Add test ad unit IDs for development
- Configure app.json with AdMob credentials

**Acceptance Criteria:**
- Apps registered in AdMob
- Ad units created and documented
- Test units verified in dev environment

**Dependencies:** None

---

#### 4.2 Ad Component Implementation (0.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Install `expo-ads-admob`
- Replace `AdBanner.tsx` placeholder with `AdMobBanner`
- Gate ads by entitlement: Free sees ads, Standard (admin only), Premium (none)
- Handle ad load failures gracefully (show spacing only)

**Acceptance Criteria:**
- Ads appear for Free tier users
- Standard admin doesn't see ads (members do)
- Premium users never see ads
- Layout stable when ad fails to load

**Dependencies:** 2.3 complete (needs entitlement gating), 4.1 complete

---

#### 4.3 Consent & Privacy (0.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Add consent prompt on first launch (if required by region)
- Add opt-out toggle in settings
- Update privacy policy screen with ad disclosure
- Avoid ads on sensitive screens (auth, paywall)

**Acceptance Criteria:**
- Consent prompt compliant with GDPR/CCPA if needed
- Settings allow ad personalization control
- No ads on auth or purchase flows

**Dependencies:** 4.2 complete

---

### Phase 1 Testing & QA (Parallel, ongoing)

#### QA.1 Unit Testing (Ongoing)
**Owner:** All Engineers  
**Tasks:**
- Write unit tests for all service methods
- Test permission checks exhaustively
- Test entitlement gating logic
- Target 80%+ coverage for critical paths

**Acceptance Criteria:**
- All P0 services have unit tests
- Edge cases covered (last admin, expired codes, etc.)
- Tests run in CI pipeline

---

#### QA.2 Integration Testing (Week 2)
**Owner:** QA + Backend Engineer  
**Tasks:**
- Set up Firebase emulator for Firestore and Functions
- Test household create/join/leave flows
- Test shift CRUD with permission variations
- Test notification triggers end-to-end

**Acceptance Criteria:**
- Emulator tests pass consistently
- Critical flows validated without hitting production

---

#### QA.3 Device Testing (Week 2)
**Owner:** QA Engineer  
**Tasks:**
- Test on 2 Android devices (1 low-end, 1 high-end)
- Test on 2 iOS devices (1 older model, 1 recent)
- Verify push notifications on all devices
- Test purchases in sandbox (iOS TestFlight, Android internal)
- Verify ads display and respect entitlements

**Acceptance Criteria:**
- All P0 features work on device matrix
- No crashes or critical bugs
- Performance acceptable on low-end devices

---

#### QA.4 Security Audit (End of Week 2)
**Owner:** Lead Developer  
**Tasks:**
- Review all authentication and authorization code
- Attempt adversarial actions (modify tier, access other household)
- Verify Firestore rules block unauthorized writes
- Check for sensitive data exposure in logs/network

**Acceptance Criteria:**
- No privilege escalation possible
- Firestore rules prevent all unauthorized access
- No sensitive data in client logs

---

### Phase 1 Deliverables
- ✅ Push notifications functional (Android + iOS)
- ✅ RevenueCat purchases working in sandbox
- ✅ RBAC enforced; leave household implemented
- ✅ Ads showing for free tier only
- ✅ Firestore rules deployed and tested
- ✅ Zero P0 bugs on device matrix
- ✅ Store-ready build generated

---

## Phase 2: P1 - Post-Launch ROI (Weeks 3-6)

### Workstream 5: Calendar Export/Sync (4 days)

#### 5.1 ICS Generation Function (2 days)
**Owner:** Backend Engineer  
**Tasks:**
- Create Cloud Function `GET /ics/:type/:id?token=`
- Generate ICS format from Firestore shifts
- Handle timezones correctly with `VTIMEZONE`
- Support user and household scope
- Implement token-based authentication

**Acceptance Criteria:**
- Endpoint returns valid ICS file
- Imports successfully to Google Calendar and Apple Calendar
- Timezone conversions accurate
- Recurrence rules work for patterns

**Dependencies:** Phase 1 complete

---

#### 5.2 Token Management (1 day)
**Owner:** Backend Engineer  
**Tasks:**
- Create `icsTokens` collection in Firestore
- Implement token generation (hashed, secure)
- Implement token revocation
- Add token validation middleware for ICS endpoint

**Acceptance Criteria:**
- Tokens are unique and securely hashed
- Revoked tokens return 403
- Token validation logs access attempts

**Dependencies:** 5.1 complete

---

#### 5.3 Export UI (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Add "Calendar Export" screen in Profile stack
- Generate/display ICS feed URLs
- Add one-tap "Add to Google/Apple" buttons
- Add revoke token functionality
- Add on-demand ICS file download

**Acceptance Criteria:**
- Users can generate and copy feed URL
- One-tap add works on iOS and Android
- Revocation takes effect within 5 minutes
- Download exports current month of shifts

**Dependencies:** 5.1, 5.2 complete

---

### Workstream 6: Localization (5 days)

#### 6.1 i18n Setup (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Install `i18next` and `react-i18next`
- Configure language detection
- Create translation files for initial locales (EN, ES, FR, DE, PT-BR)
- Set up namespace structure

**Acceptance Criteria:**
- i18n initialized and detects device locale
- Translation files structured and loaded

**Dependencies:** Phase 1 complete

---

#### 6.2 Screen & Component Translation (2 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Wrap all UI strings with `t()` function
- Translate auth, calendar, household, profile screens
- Translate common components (buttons, alerts, errors)
- Add translations for notification messages

**Acceptance Criteria:**
- All major screens support locale switching
- No hardcoded English strings in UI
- Translations grammatically correct

**Dependencies:** 6.1 complete

---

#### 6.3 Date/Time/Currency Formatting (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Integrate `date-fns` with locale support
- Format dates per locale (DD/MM vs MM/DD)
- Support 12/24 hour time format
- Display localized currency in paywall (via RevenueCat)

**Acceptance Criteria:**
- Dates display correctly for each locale
- Time format respects device settings
- Currency matches store locale

**Dependencies:** 6.1 complete

---

#### 6.4 Testing & QA (1 day)
**Owner:** QA Engineer  
**Tasks:**
- Test app in each supported locale
- Verify text doesn't overflow in longer languages (DE)
- Check RTL support if needed (future)
- Validate date/time parsing

**Acceptance Criteria:**
- App functional in all supported locales
- UI layout stable with translated text

**Dependencies:** 6.2, 6.3 complete

---

### Workstream 7: Onboarding Templates (3 days)

#### 7.1 Template Library (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Expand `src/utils/shiftPatterns.ts` with templates
- Add patterns: 4-on-4-off, 2-2-3, 12h nights, 8h days, custom
- Define template metadata (name, description, icon)

**Acceptance Criteria:**
- At least 5 common patterns defined
- Each template includes start date parameter

**Dependencies:** Phase 1 complete

---

#### 7.2 Onboarding Wizard (1.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Create onboarding flow screens (new user detected)
- Step 1: Create/join household
- Step 2: Select shift pattern template
- Step 3: Set start date and generate shifts
- Step 4: Enable notifications

**Acceptance Criteria:**
- New users guided through setup in <60 seconds
- Pattern selection intuitive with preview
- Batch shift creation fast (<5s for 90 days)

**Dependencies:** 7.1 complete

---

#### 7.3 Batch Operations (0.5 days)
**Owner:** Backend Engineer  
**Tasks:**
- Implement batched shift creation for templates
- Add rollback on partial failures
- Prevent duplicate shift creation
- Optimize Firestore batch writes

**Acceptance Criteria:**
- 90 days of shifts created in <5 seconds
- Failures handled gracefully with clear messaging
- No duplicates even if operation retried

**Dependencies:** 7.2 complete

---

### Workstream 8: Invites & Referrals (4 days)

#### 8.1 Enhanced Invite Flows (1.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Add contact picker for SMS/email invites
- Generate QR code for join code
- Implement share sheet integration
- Add invite tracking (sent count, accepted count)

**Acceptance Criteria:**
- Users can invite via SMS, email, QR, or share link
- QR code scannable and opens app with join flow
- Tracking visible in household settings

**Dependencies:** Phase 1 complete

---

#### 8.2 Referral System Backend (1.5 days)
**Owner:** Backend Engineer  
**Tasks:**
- Add `referrerId` field to invitation model
- Track referral events in Firestore
- Implement reward logic (grant +7 days Premium to both users)
- Add basic fraud detection (limit rewards per user/device)

**Acceptance Criteria:**
- Referrer tracked when invitee joins
- Reward granted when invitee creates first shift
- Abuse prevented (max 5 referrals per user)

**Dependencies:** 8.1 complete

---

#### 8.3 Referral UI (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Add referral section in Profile
- Display referral code and share options
- Show referral status (pending/complete)
- Add banner when reward granted

**Acceptance Criteria:**
- Users see referral code and status
- Reward notification appears when earned
- Share flow functional

**Dependencies:** 8.2 complete

---

### Workstream 9: Paywall Polish (2 days)

#### 9.1 Enhanced Comparison Screen (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Update `PlanComparisonScreen` with dynamic offerings
- Add feature comparison table (visual checkmarks)
- Display localized benefits per tier
- Add customer testimonials/trust signals

**Acceptance Criteria:**
- Benefits clearly differentiated by tier
- Pricing dynamic from RevenueCat
- Design polished and professional

**Dependencies:** Phase 1 Workstream 2 complete

---

#### 9.2 Contextual Upgrade Prompts (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Add contextual `UpgradePrompt` at limit hits
- Track paywall funnel metrics (view → trial start → purchase)
- Add A/B test capability for copy variants (simple local config)
- Add dismissal tracking

**Acceptance Criteria:**
- Prompts appear at correct moments (e.g., adding 3rd member on Free)
- Metrics logged for funnel analysis
- Copy variants testable via config

**Dependencies:** 9.1 complete

---

### Phase 2 Testing & Deliverables
- ✅ ICS export functional and tested
- ✅ App localized for 5 languages
- ✅ Onboarding wizard converts new users
- ✅ Referral system tracks and rewards
- ✅ Paywall conversion improved vs baseline
- ✅ All P1 features tested on device matrix

---

## Phase 3: P2 - Differentiators (Weeks 7-12)

### Workstream 10: Smart Conflict Detection (5 days)

#### 10.1 Conflict Detection Logic (2 days)
**Owner:** Backend Engineer  
**Tasks:**
- Create Cloud Function to detect overlapping shifts
- Define conflict types (double-booked, coverage gap, childcare)
- Write to `conflicts` collection with metadata
- Trigger on shift create/update/delete

**Acceptance Criteria:**
- Overlapping shifts detected within seconds
- False positive rate <5%
- Coverage gaps identified for households with childcare flag

**Dependencies:** Phase 1 complete

---

#### 10.2 Conflict Resolution UI (2 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Add conflict banner on Day view and Calendar
- Show conflict details and affected users
- Add quick actions (edit shift, resolve, dismiss)
- Track resolution status

**Acceptance Criteria:**
- Conflicts visible and actionable
- Resolution updates Firestore
- Dismissed conflicts hidden but logged

**Dependencies:** 10.1 complete

---

#### 10.3 Daily Summary Notification (1 day)
**Owner:** Backend Engineer  
**Tasks:**
- Add scheduled function for daily conflict summary
- Send push notification with summary if conflicts exist
- Allow opt-out in settings

**Acceptance Criteria:**
- Users receive daily summary at chosen time
- Summary includes count and types of conflicts
- Opt-out respected

**Dependencies:** 10.2 complete

---

### Workstream 11: Widgets & Lock Screen (7 days)

#### 11.1 Feasibility Spike (2 days)
**Owner:** Lead Developer  
**Tasks:**
- Research Expo widget capabilities (may require EAS or native modules)
- Prototype basic widget on iOS and Android
- Determine limitations and required native code

**Acceptance Criteria:**
- Feasibility documented
- Prototype widget displays static data
- Decision made: continue or defer

**Dependencies:** Phase 2 complete

---

#### 11.2 Widget Implementation (3 days, if feasible)
**Owner:** Frontend Engineer  
**Tasks:**
- Create iOS widget (SwiftUI or React Native Widget)
- Create Android widget (Kotlin/Java or React Native Widget)
- Display "Next Shift" and "Today's Schedule"
- Handle data refresh and tap actions

**Acceptance Criteria:**
- Widget updates when shifts change
- Tapping widget opens app to relevant screen
- Design consistent with app

**Dependencies:** 11.1 complete and approved

---

#### 11.3 Settings & Polish (1 day)
**Owner:** Frontend Engineer  
**Tasks:**
- Add widget settings in app (enable/disable, refresh frequency)
- Optimize battery usage
- Add widget setup instructions

**Acceptance Criteria:**
- Users can configure widget
- Battery impact minimal
- Instructions clear

**Dependencies:** 11.2 complete

---

#### 11.4 Testing (1 day)
**Owner:** QA Engineer  
**Tasks:**
- Test widgets on multiple devices and OS versions
- Verify data accuracy and refresh timing
- Test battery drain

**Acceptance Criteria:**
- Widgets work reliably on device matrix
- No excessive battery drain

**Dependencies:** 11.3 complete

---

### Workstream 12: Shareable Schedule (3 days)

#### 12.1 Image Generation (1.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Create offscreen component for two-week schedule render
- Use `captureRef` from Expo to generate image
- Support dark/light themes
- Optimize image quality

**Acceptance Criteria:**
- Generated image crisp and readable
- Colors match app theme
- Export includes branding

**Dependencies:** Phase 2 complete

---

#### 12.2 PDF Generation (1 day, optional)
**Owner:** Backend Engineer  
**Tasks:**
- Create Cloud Function to generate PDF from schedule data
- Use library like PDFKit or Puppeteer
- Support A4 and Letter sizes

**Acceptance Criteria:**
- PDF printable and high-quality
- Layout professional

**Dependencies:** Phase 2 complete

---

#### 12.3 Share Integration (0.5 days)
**Owner:** Frontend Engineer  
**Tasks:**
- Add "Share Schedule" button in Calendar
- Integrate native share sheet
- Support image and PDF formats

**Acceptance Criteria:**
- Share works on iOS and Android
- Formats selectable by user

**Dependencies:** 12.1 or 12.2 complete

---

### Workstream 13: Observability (2 days)

#### 13.1 Sentry Integration (1 day)
**Owner:** Backend Engineer  
**Tasks:**
- Install Sentry SDK for React Native
- Configure source maps for error tracking
- Set up release tracking
- Add breadcrumbs for key user actions

**Acceptance Criteria:**
- Crashes reported to Sentry with stack traces
- Source maps allow readable errors
- Release versions tracked

**Dependencies:** Phase 2 complete

---

#### 13.2 Analytics Events (1 day)
**Owner:** Frontend + Backend Engineers  
**Tasks:**
- Add key analytics events (see event taxonomy in scope doc)
- Use Amplitude or Segment for event tracking
- Add privacy controls and opt-out
- Update privacy policy

**Acceptance Criteria:**
- Core funnels tracked (activation, purchase, export, referral)
- Events visible in analytics dashboard
- Privacy compliant

**Dependencies:** 13.1 complete

---

### Phase 3 Testing & Deliverables
- ✅ Conflict detection live and accurate
- ✅ Widgets deployed (if feasible) or documented as future work
- ✅ Shareable schedule exports functional
- ✅ Sentry and analytics instrumented
- ✅ Crash-free sessions > 99%
- ✅ All features documented in help center

---

## Final Pre-Launch Checklist (Week 12)

### Store Submission Prep
- [ ] App icons and splash screens finalized (all sizes)
- [ ] Screenshots prepared (iOS: 6.5", 5.5"; Android: phone, tablet)
- [ ] App preview videos created (optional but recommended)
- [ ] Privacy labels completed (App Store Connect, Play Console)
- [ ] Age rating questionnaire completed
- [ ] Subscription disclosure and terms links active
- [ ] Support URL and privacy policy URLs live

### Build & Deploy
- [ ] EAS production builds generated for iOS and Android
- [ ] Builds uploaded to App Store Connect and Play Console
- [ ] TestFlight and Internal Testing tracks validated
- [ ] Firestore indexes deployed to production
- [ ] Cloud Functions deployed to production
- [ ] Environment variables and API keys verified

### Documentation
- [ ] README updated with build instructions
- [ ] API documentation for Cloud Functions
- [ ] Runbooks for incident response (push failures, payment issues)
- [ ] User-facing help center articles

### Monitoring
- [ ] Sentry alerts configured
- [ ] Firebase monitoring dashboards set up
- [ ] RevenueCat webhooks tested (if used)
- [ ] AdMob revenue tracking enabled

---

## Risk Register & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Push notification provisioning complex | High | Medium | Start with Android; follow Expo guides; allocate buffer time |
| Store review rejection for paywall | High | Low | Clear, honest messaging; localized pricing; follow platform guidelines |
| RevenueCat integration issues | High | Low | Test thoroughly in sandbox; use their support; have rollback plan |
| Expo limitations for widgets | Medium | Medium | Feasibility spike first; defer if blocked; document as future work |
| Security vulnerabilities in RBAC | Critical | Low | Comprehensive testing; security audit; emulator rule tests |
| Performance issues on low-end devices | Medium | Medium | Profile early; optimize batch operations; test on target devices |
| Translation quality poor | Low | Medium | Use professional translators for key locales; iterate based on feedback |

---

## Success Metrics (90 Days Post-Launch)

### Activation
- 40%+ of sign-ups complete onboarding and create first shift
- 60%+ grant push notification permission

### Engagement
- 25%+ MAU/DAU ratio (monthly active / daily active users)
- 3+ sessions per week per active user
- 50%+ of users add at least one household member

### Monetization
- 10%+ trial start rate from free users
- 60%+ trial to paid conversion
- $X MRR target (define based on pricing and market)

### Quality
- 99%+ crash-free sessions
- <1% payment failure rate
- 4.5+ app store rating

### Retention
- Day 7 retention >40%
- Day 30 retention >25%

---

## Communication Plan

### Daily Standups (15 min)
- What I did yesterday
- What I'm doing today
- Any blockers

### Weekly Sprint Review (Friday, 1 hour)
- Demo completed work
- Review metrics and KPIs
- Adjust priorities if needed

### Bi-Weekly Retrospective (30 min)
- What went well
- What didn't go well
- Action items for improvement

### Stakeholder Updates (Weekly)
- Progress summary against plan
- Risks and mitigation
- Next week's goals

---

## Appendix A: Key File Changes Reference

### New Files to Create
- `src/services/notification.service.ts` (replace stub)
- `src/services/billing.service.ts` (new)
- `functions/index.js` (new Cloud Functions)
- `functions/package.json` (new)
- `firestore.rules` (new or update)
- `src/screens/profile/CalendarExportScreen.tsx` (new)
- `src/screens/auth/OnboardingWizardScreen.tsx` (new)
- `src/contexts/LocaleContext.tsx` (new)
- `translations/en.json`, `translations/es.json`, etc. (new)

### Files to Modify
- `src/navigation/MainTabNavigator.tsx` (badge count)
- `src/services/subscription.service.ts` (entitlement integration)
- `src/components/AdBanner.tsx` (real AdMob implementation)
- `src/services/household.service.ts` (RBAC, leave household)
- `src/services/shift.service.ts` (permission enforcement)
- `src/components/SubscriptionComponents.tsx` (RevenueCat offerings)
- `app.json` (Expo Notifications, AdMob, RevenueCat config)
- `package.json` (new dependencies)

### Dependencies to Install
```json
{
  "expo-notifications": "~0.28.0",
  "react-native-purchases": "^7.0.0",
  "expo-ads-admob": "~13.0.0",
  "i18next": "^23.0.0",
  "react-i18next": "^13.0.0",
  "date-fns": "^3.0.0",
  "@sentry/react-native": "^5.0.0"
}
```

---

## Appendix B: Testing Matrix

| Feature | Unit | Integration | E2E | Device |
|---------|------|-------------|-----|--------|
| Push Notifications | ✅ | ✅ | ✅ | ✅ |
| Payments | ✅ | ✅ | ✅ | ✅ |
| RBAC | ✅ | ✅ | ✅ | ✅ |
| Ads | ✅ | - | ✅ | ✅ |
| ICS Export | ✅ | ✅ | - | ✅ |
| Localization | ✅ | - | - | ✅ |
| Templates | ✅ | ✅ | - | ✅ |
| Referrals | ✅ | ✅ | - | ✅ |
| Conflicts | ✅ | ✅ | - | ✅ |
| Widgets | - | - | - | ✅ |
| Exports | ✅ | - | - | ✅ |
| Analytics | ✅ | - | - | ✅ |

---

**End of Implementation Plan**
