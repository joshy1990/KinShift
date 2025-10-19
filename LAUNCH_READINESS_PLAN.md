# Next Phase Action Plan - LinkShift Launch Readiness
**Date:** October 19, 2025  
**Status:** Ready to begin  
**Priority:** CRITICAL - Launch Blockers

---

## Phase: Security Hardening & Launch Prep (Week 1-2)

### CRITICAL PATH - Must Complete Before Launch

---

## Week 1: Security Enforcement (Days 1-3)

### Day 1: RBAC Permission Checks

#### Task 1.1: Complete `canInviteMember` Check
**Owner:** Lead/Backend  
**File:** `src/services/household.service.ts` ~line 100  
**Time Estimate:** 2 hours

**Acceptance Criteria:**
- [ ] Returns `{allowed: true/false, reason?: string}`
- [ ] Checks if inviter is admin
- [ ] Checks household member limit vs subscription tier
- [ ] Checks if target user already in household
- [ ] Unit tests pass (4/4 scenarios)

**Implementation Guide:**
```typescript
async canInviteMember(
  householdId: string, 
  userId: string, 
  targetEmail: string
): Promise<PermissionCheckResult> {
  // 1. Is userId an admin?
  // 2. Is household at member limit?
  // 3. Is target already a member?
  // 4. Return {allowed, reason}
}
```

**Test Scenarios:**
- ✅ Admin can invite when under limit
- ✅ Member cannot invite
- ✅ Admin cannot invite when at limit
- ✅ Cannot re-invite existing member

---

#### Task 1.2: Complete `canRemoveMember` Check
**Owner:** Lead/Backend  
**File:** `src/services/household.service.ts` ~line 120  
**Time Estimate:** 2 hours

**Acceptance Criteria:**
- [ ] Returns `{allowed: true/false, reason?: string}`
- [ ] Only admins can remove
- [ ] Cannot remove last admin
- [ ] Can remove self
- [ ] Unit tests pass (5/5 scenarios)

**Implementation Guide:**
```typescript
async canRemoveMember(
  householdId: string,
  targetUserId: string,
  requestingUserId: string
): Promise<PermissionCheckResult> {
  // 1. Is requester an admin?
  // 2. Is target the last admin?
  // 3. (Self-removal is always allowed)
  // 4. Return {allowed, reason}
}
```

**Test Scenarios:**
- ✅ Admin can remove member
- ✅ Member cannot remove anyone
- ✅ Cannot remove last admin
- ✅ Last admin can remove self (triggers promotion)
- ✅ User can remove self

---

#### Task 1.3: Complete `canManageRoles` Check
**Owner:** Lead/Backend  
**File:** `src/services/household.service.ts` ~line 140  
**Time Estimate:** 2.5 hours

**Acceptance Criteria:**
- [ ] Returns `{allowed: true/false, reason?: string}`
- [ ] Only admins can manage roles
- [ ] Cannot demote last admin
- [ ] Proper error messages
- [ ] Unit tests pass (6/6 scenarios)

**Implementation Guide:**
```typescript
async canManageRoles(
  householdId: string,
  userId: string
): Promise<PermissionCheckResult> {
  // 1. Is userId an admin?
  // 2. Return {allowed: true/false, reason}
}
```

**Test Scenarios:**
- ✅ Admin can manage roles
- ✅ Member cannot manage roles
- ✅ Cannot demote last admin
- ✅ Can promote member to admin
- ✅ Can demote admin to member
- ✅ Admin status check accurate

---

#### Task 1.4: Implement Last-Admin Transfer Logic
**Owner:** Lead/Backend  
**File:** `src/services/household.service.ts` (leaveHousehold method)  
**Time Estimate:** 1.5 hours

**Acceptance Criteria:**
- [ ] When last admin leaves, promotes longest-standing member
- [ ] If no members available, prevents leave (error)
- [ ] UI prompts admin before leaving
- [ ] Audit log records transfer

**Logic:**
```typescript
// In leaveHousehold():
if (isLastAdmin && household.members.length > 1) {
  // Find member with earliest joinDate
  // Promote them to admin
  // Record in audit log
  // Proceed with leave
} else if (isLastAdmin && household.members.length === 1) {
  throw new Error("Cannot leave: last admin and no other members")
}
```

---

### Day 2: Firestore Security Rules & Verification

#### Task 2.1: Review Firestore Security Rules
**Owner:** Lead/Backend  
**File:** `firestore.rules` (if exists) or review in Firebase Console  
**Time Estimate:** 3 hours

**Required Rules:**

```js
// Users collection
match /users/{userId} {
  allow read: if request.auth.uid == userId;
  allow create: if request.auth.uid == resource.data.id;
  allow write: if request.auth.uid == userId 
               && !(resource.data.role.changed() 
                    && request.auth.uid != resource.data.id);
}

// Households collection
match /households/{householdId} {
  allow read: if request.auth.uid in resource.data.members;
  allow create: if request.auth.uid == request.resource.data.creatorId;
  allow write: if request.auth.uid in resource.data.admins;
  allow update: if request.auth.uid in resource.data.admins;
}

// Shifts collection
match /shifts/{shiftId} {
  allow read: if request.auth.uid == resource.data.ownerId
               || request.auth.uid in 
                  firestore.document(/databases/(default)/documents/households/
                                    $(resource.data.householdId)).data.members;
  allow create: if request.auth.uid == request.resource.data.ownerId;
  allow write: if request.auth.uid == resource.data.ownerId
               || (request.auth.uid in 
                   firestore.document(/databases/(default)/documents/households/
                                     $(resource.data.householdId)).data.admins);
}
```

**Verification Checklist:**
- [ ] Users can only read/write own profile
- [ ] Household reads require membership
- [ ] Household writes require admin status
- [ ] Shifts readable by owner or household members
- [ ] Shifts writable by owner or household admin
- [ ] No cross-user edit vulnerabilities

---

#### Task 2.2: Test Rules with Firestore Emulator
**Owner:** Lead/Backend  
**Time Estimate:** 2 hours

**Setup:**
```bash
npm install -g @firebase/cli
firebase init emulators
firebase emulators:start
```

**Test Cases to Verify:**
- [ ] User1 cannot read User2's profile
- [ ] User1 can read household shifts after joining
- [ ] User1 cannot edit another user's shift (non-admin)
- [ ] Admin can edit member shifts
- [ ] All denied attempts return 403

---

### Day 3: Test Infrastructure & Bug Fixes

#### Task 3.1: Fix subscription.service.ts Function Call Error
**Owner:** Frontend  
**File:** `src/services/subscription.service.ts` line 516  
**Time Estimate:** 0.5 hours

**Issue:**
```typescript
// WRONG: 6 arguments passed
notifyMembersOfExcess(
  householdId,
  excessMembers,
  'Admin'
)

// CORRECT: Check signature
```

**Required:**
- [ ] Find correct `notifyMembersOfExcess` signature
- [ ] Fix function call to match
- [ ] Verify downgrade workflow works

---

#### Task 3.2: Fix TwoWeekViewScreen ShiftType Error
**Owner:** Frontend  
**File:** `src/screens/calendar/TwoWeekViewScreen.tsx` line 91  
**Time Estimate:** 0.25 hours

**Issue:**
```typescript
// WRONG
shiftType: 'days'

// CORRECT
shiftType: 'day'
```

---

#### Task 3.3: Install Jest & Configure Testing
**Owner:** Frontend  
**Time Estimate:** 2 hours

**Steps:**
1. [ ] Install dependencies:
   ```bash
   npm install --save-dev jest @types/jest jest-expo
   ```

2. [ ] Create `jest.config.js`:
   ```js
   module.exports = {
     preset: 'jest-expo',
     testEnvironment: 'node',
   };
   ```

3. [ ] Update `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "types": ["jest", "@types/node"]
     }
   }
   ```

4. [ ] Update `package.json`:
   ```json
   {
     "scripts": {
       "test": "jest",
       "test:watch": "jest --watch"
     }
   }
   ```

5. [ ] Run tests:
   ```bash
   npm test
   ```

6. [ ] Fix failing tests (update test file imports)

---

## Week 2: Notifications & Payment (Days 4-6)

### Day 4: Expo Notifications Setup

#### Task 4.1: Install Expo Notifications
**Owner:** Backend/DevOps  
**Time Estimate:** 1 hour

```bash
npx expo install expo-notifications
npx expo install expo-device
```

---

#### Task 4.2: Implement FCM Token Registration
**Owner:** Backend  
**File:** `src/services/notification.service.ts`  
**Time Estimate:** 4 hours

**Acceptance Criteria:**
- [ ] Async token retrieval on app init
- [ ] Token stored in Firestore `devices` collection
- [ ] Token refresh handled
- [ ] Platform detection (iOS vs Android)

**Implementation:**
```typescript
async registerDeviceToken(userId: string): Promise<void> {
  // 1. Get device token
  // 2. Get device info (platform, OS version)
  // 3. Store in firestore: users/{userId}/devices/{deviceId}
  // 4. Return token hash for later use
}
```

---

#### Task 4.3: Implement Notification Handlers
**Owner:** Backend  
**File:** `src/services/notification.service.ts`  
**Time Estimate:** 4 hours

**Handlers Needed:**
- [ ] Foreground notification listener
- [ ] Background notification handler
- [ ] Deep linking from notification
- [ ] Badge count management

---

#### Task 4.4: Update MainTabNavigator Badge Count
**Owner:** Frontend  
**File:** `src/navigation/MainTabNavigator.tsx`  
**Time Estimate:** 1 hour

**Acceptance Criteria:**
- [ ] Notification tab shows unread count badge
- [ ] Badge updates in real-time
- [ ] Badge clears when notifications viewed

---

### Day 5: RevenueCat Basic Integration

#### Task 5.1: Setup RevenueCat Account & Config
**Owner:** DevOps  
**Time Estimate:** 1.5 hours

**Steps:**
- [ ] Create RevenueCat account
- [ ] Create Apple App Store product (in-app purchase)
- [ ] Create Google Play product
- [ ] Get RevenueCat public key
- [ ] Update `app.json` with key

---

#### Task 5.2: Implement Entitlement Check
**Owner:** Backend  
**File:** `src/services/subscription.service.ts`  
**Time Estimate:** 2 hours

**Acceptance Criteria:**
- [ ] `getEntitlements(userId)` returns current tier
- [ ] Reads from RevenueCat API
- [ ] Caches result with 5-min TTL
- [ ] Fallback to local tier if API down

---

#### Task 5.3: Integrate Payment Flow
**Owner:** Frontend  
**File:** `src/screens/profile/PlanComparisonScreen.tsx`  
**Time Estimate:** 2 hours

**Acceptance Criteria:**
- [ ] Clicking upgrade shows purchase dialog
- [ ] RevenueCat SDK handles payment
- [ ] Success triggers entitlement sync
- [ ] Error shows user-friendly message

---

### Day 6: QA & Launch Prep

#### Task 6.1: Full User Flow Testing
**Owner:** QA/Lead  
**Time Estimate:** 4 hours

**Test Paths:**
- [ ] New user → Signup → Create household
- [ ] User2 → Join household via code
- [ ] Create shift → Verify both users see it
- [ ] Admin removes user → Verify shifts handled
- [ ] User leaves household → Verify last-admin protection
- [ ] Exceed member limit → Verify error
- [ ] Upgrade to Premium → Verify limit increases

**Platforms to Test:**
- [ ] Android (physical or emulator)
- [ ] iOS (physical if available)
- [ ] Web (Chrome/Safari)

---

#### Task 6.2: Security Checklist
**Owner:** Lead  
**Time Estimate:** 1.5 hours

- [ ] All permission checks in place
- [ ] Firestore rules tested
- [ ] No console errors
- [ ] Errors don't leak sensitive data
- [ ] Authentication required for all APIs
- [ ] Rate limiting active

---

#### Task 6.3: Performance Review
**Owner:** Lead  
**Time Estimate:** 1 hour

- [ ] App startup time < 3 seconds
- [ ] Pattern creation < 2 seconds
- [ ] Household loading < 1 second
- [ ] No memory leaks in subscriptions
- [ ] No console warnings

---

## Success Criteria for Launch

### Before Pushing to Play Store/App Store:

**Security:**
- ✅ All permission checks implemented and tested
- ✅ Firestore rules verified
- ✅ No security test failures
- ✅ RBAC enforced at service layer

**Features:**
- ✅ Users can create/join households
- ✅ Shifts visible in real-time
- ✅ Patterns work correctly
- ✅ Notifications send and display
- ✅ Payment flow works end-to-end

**Code Quality:**
- ✅ Zero TypeScript compile errors
- ✅ Unit tests for critical services pass
- ✅ No console errors
- ✅ Proper error handling

**Devices:**
- ✅ Tested on Android (low-end + flagship)
- ✅ Tested on iOS (if available)
- ✅ Tested on web (Chrome + Safari)

**Documentation:**
- ✅ README updated with setup instructions
- ✅ Architecture documented
- ✅ Known issues logged
- ✅ Deployment process documented

---

## Estimated Timeline

| Phase | Days | Hours | Start | End |
|-------|------|-------|-------|-----|
| Security Hardening | 3 | 24 | Oct 20 | Oct 22 |
| Notifications | 1.5 | 10 | Oct 23 | Oct 24 |
| Payment Integration | 1.5 | 8 | Oct 24 | Oct 25 |
| QA & Polish | 1 | 6.5 | Oct 26 | Oct 26 |
| **Total** | **7** | **48.5** | Oct 20 | Oct 26 |

**Ready for Launch:** October 26, 2025 (if on schedule)

---

## Contingency Plan

If any day slips:

**Critical Path (Cannot Delay):**
1. Security checks completion
2. Notifications basic implementation
3. Bug fixes (subscription, ShiftType)

**Nice to Have (Can Push to Day 1 Post-Launch):**
1. Full payment integration testing
2. Performance optimization
3. Comprehensive QA

**If 2+ days behind:**
- Delay launch 1 week
- Use time for additional security testing
- Add more device testing
- Polish edge cases

---

## Sign-Off

- [ ] Lead Engineer: Approved
- [ ] QA Lead: Approved
- [ ] Product Owner: Approved

---

**Document Created:** October 19, 2025  
**Status:** Ready for execution  
**Next Update:** After Day 1 completion
