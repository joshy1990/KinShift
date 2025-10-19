# 🚀 Day 2: Firestore Security Rules Implementation

**Date:** October 19, 2025  
**Phase:** Security Hardening - Database Layer  
**Objective:** Deploy comprehensive Firestore Security Rules

---

## 📋 Day 2 Overview

**Goal:** Implement database-level security rules that mirror and enforce service-layer RBAC

**Expected Duration:** 6-8 hours  
**Key Deliverables:**
1. ✅ firestore.rules - Complete security rules file
2. ✅ Rules deployment strategy
3. ✅ Test cases for rule validation
4. ✅ Emulator testing guide
5. ✅ Production deployment plan

---

## 🔐 Firestore Security Rules Architecture

### Rule Structure Overview

```
USERS COLLECTION
├── Read: Only user can read their own document
├── Write: Only user can write their own document
└── Protection: Prevents unauthorized profile access

HOUSEHOLDS COLLECTION
├── Read: All authenticated users (client filters by membership)
├── Write: Only household admins can modify
├── Settings: Members read, admins write
└── AuditLog: Members read, system only writes

SHIFTS COLLECTION
├── Read: Only household members can read shifts
├── Create: Any authenticated user (ownerId must match)
├── Update: Owner or household members (if settings allow)
├── Delete: Only shift owner can delete
└── Logic: Respects household settings (allowMemberEditOthers)

DAY NOTES COLLECTION
├── Read: Only note owner
├── Write: Only note owner
└── Protection: Prevents unauthorized note access

MESSAGES COLLECTIONS
├── shiftMessages: Household members can read/write
├── dayMessages: Day note owner can read/write
└── Deletion: Only message author can delete

INVITATIONS COLLECTION
├── Read: Only invited user
├── Create: Only household admins
├── Update: Only invited user (accept/reject)
└── Delete: Only household admins

NOTIFICATIONS COLLECTION
├── Read: Only user can read own notifications
├── Write: Backend only (disabled for clients)
└── Protection: Prevents notification tampering

SUBSCRIPTIONS COLLECTION
├── Read: Only user can read own subscription
├── Write: Backend only (disabled for clients)
└── Protection: Prevents subscription tampering
```

---

## 🔒 Rule Matching System

### Helper Functions Defined

#### Authentication
```
isAuthenticated()
  └─ Returns: request.auth != null
```

#### User Ownership
```
isOwner(userId)
  └─ Returns: request.auth.uid == userId
```

#### Household Access
```
isHouseholdMember(householdId)
  └─ Returns: user's ID in household.members array

isHouseholdAdmin(householdId)
  └─ Returns: user's ID in household.admins array
```

#### Shift Access
```
canAccessShift(shiftId)
  ├─ Personal shifts: Only owner
  └─ Household shifts: Any household member

canEditShift(shiftId)
  ├─ Owner: Can always edit own shifts
  ├─ Non-owner: Can edit IF household member AND allowMemberEditOthers == true
  └─ Personal shifts: Only owner can edit
```

---

## 📊 Rule-by-Rule Breakdown

### 1. USERS Collection

```firestore
match /users/{userId} {
  allow read: if isOwner(userId);
  allow write: if isOwner(userId);
}
```

**Purpose:** Protect user profile data  
**Rules:**
- ✅ Users can read their own profile
- ✅ Users can write their own profile
- ❌ Users cannot read other users' profiles
- ❌ Users cannot modify other users' profiles

**Mirrors Service-Layer:** User authentication in auth.service.ts

---

### 2. HOUSEHOLDS Collection

```firestore
match /households/{householdId} {
  allow read: if isAuthenticated();
  allow write: if isHouseholdAdmin(householdId);
}
```

**Purpose:** Protect household management data  
**Rules:**
- ✅ All authenticated users can read households (client filters by membership)
- ✅ Only admins can write households
- ✅ Settings subcollection: members read, admins write
- ✅ AuditLog subcollection: members read, backend only writes

**Mirrors Service-Layer:** Permission checks in household.service.ts
- canManageRoles() - only admins
- canInviteMember() - only admins
- canRemoveMember() - admin or self

---

### 3. SHIFTS Collection

```firestore
match /shifts/{shiftId} {
  allow read: if isAuthenticated() && canAccessShift(shiftId);
  allow update: if isAuthenticated() && canEditShift(shiftId);
  allow delete: if isAuthenticated() && isShiftOwner(shiftId);
  allow create: if isAuthenticated() && 
    request.resource.data.ownerId == request.auth.uid;
}
```

**Purpose:** Protect shift data with fine-grained access control  
**Rules:**
- ✅ Personal shifts: Only owner can read/edit/delete
- ✅ Household shifts: Members can read
- ✅ Shift editing: Respects household.settings.allowMemberEditOthers
- ✅ Deletion: Only owner can delete
- ✅ Creation: User must set ownerId to their own ID

**Mirrors Service-Layer:** Validation in shift.service.ts
- validateShiftPermission()
- validateShiftPermissionWithSettings()

---

### 4. DAY NOTES Collection

```firestore
match /dayNotes/{dayNoteId} {
  let dayNote = resource.data;
  allow read: if isOwner(dayNote.userId);
  allow write: if isOwner(dayNote.userId);
}
```

**Purpose:** Protect personal daily notes  
**Rules:**
- ✅ Only note creator can read their notes
- ✅ Only note creator can modify their notes
- ❌ Others cannot access notes

---

### 5. MESSAGES Collections

**Shift Messages:**
```firestore
match /shiftMessages/{messageId} {
  allow read: if isAuthenticated() && canAccessShift(shiftId);
  allow create: if isAuthenticated() && canAccessShift(shiftId);
  allow delete: if isOwner(message.authorId);
}
```

**Day Messages:**
```firestore
match /dayMessages/{messageId} {
  allow read: if isOwner(dayNote.userId);
  allow create: if isOwner(dayNote.userId);
  allow delete: if isOwner(message.authorId);
}
```

**Purpose:** Protect shift and day-note messages  
**Rules:**
- ✅ Shift messages: Household members can read/create
- ✅ Day messages: Day note owner only
- ✅ Deletion: Message author can delete own messages

---

### 6. INVITATIONS Collection

```firestore
match /invitations/{invitationId} {
  let invitation = resource.data;
  allow read: if isOwner(invitation.invitedUserId);
  allow create: if isAuthenticated() && isHouseholdAdmin(invitation.householdId);
  allow update: if isOwner(invitation.invitedUserId);
  allow delete: if isHouseholdAdmin(invitation.householdId);
}
```

**Purpose:** Protect household invitations  
**Rules:**
- ✅ Invited user can read their invitations
- ✅ Only admins can create invitations
- ✅ Invited user can accept/reject
- ✅ Only admins can delete expired invitations

**Mirrors Service-Layer:** canInviteMember() in household.service.ts

---

### 7. NOTIFICATIONS Collection

```firestore
match /notifications/{notificationId} {
  let notification = resource.data;
  allow read: if isOwner(notification.userId);
  allow write: if false;
}
```

**Purpose:** Protect user notifications  
**Rules:**
- ✅ Users can read their own notifications
- ❌ Clients cannot write (backend only)
- ✅ Prevents notification tampering

---

### 8. SUBSCRIPTIONS Collection

```firestore
match /subscriptions/{subscriptionId} {
  let subscription = resource.data;
  allow read: if isOwner(subscription.userId);
  allow write: if false;
}
```

**Purpose:** Protect subscription data  
**Rules:**
- ✅ Users can read their own subscription
- ❌ Clients cannot write (backend only)
- ✅ Prevents subscription tampering

---

## 🧪 Test Cases for Security Rules

### Test Suite 1: User Access

```
✅ User can read their own profile
❌ User cannot read another user's profile
✅ User can update their own profile
❌ User cannot update another user's profile
✅ User cannot create documents in users collection
```

### Test Suite 2: Household Access

```
✅ Authenticated user can list households
✅ Household member can read household data
✅ Household admin can update household
❌ Non-member cannot read household (except list)
❌ Non-admin cannot update household
✅ Member can read settings
❌ Non-admin cannot update settings
```

### Test Suite 3: Shift Access

```
✅ Shift owner can read personal shift
✅ Shift owner can update personal shift
✅ Shift owner can delete personal shift
❌ Non-owner cannot read personal shift
✅ Household member can read household shift
✅ Household member can update household shift (if settings allow)
❌ Non-member cannot read household shift
✅ Only owner can delete shifts
```

### Test Suite 4: Message Access

```
✅ Household member can read shift messages
✅ Household member can create shift messages
✅ Message author can delete own messages
❌ Non-member cannot read shift messages
✅ Day note owner can read/create day messages
❌ Non-owner cannot access day messages
```

### Test Suite 5: Invitation Access

```
✅ Invited user can read invitation
✅ Invited user can accept/reject invitation
❌ Non-invited cannot read invitation
✅ Household admin can create invitation
❌ Non-admin cannot create invitation
❌ Invited user cannot create invitations
```

---

## 📦 Deployment Strategy

### Phase 1: Development (Today)

1. ✅ Create firestore.rules file
2. ✅ Create test cases
3. ⏳ Test with Firebase Emulator
4. ⏳ Validate against service-layer permissions

### Phase 2: Staging (Tomorrow)

1. ⏳ Deploy to Firebase Console
2. ⏳ Run integration tests
3. ⏳ Monitor error rates
4. ⏳ Validate with real data

### Phase 3: Production (Day 3)

1. ⏳ Final review
2. ⏳ Deploy to production
3. ⏳ Monitor permissions
4. ⏳ Document and finalize

---

## 🛠️ Deployment Instructions

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Firebase Project

```bash
firebase init
```

### Step 4: Deploy Rules

```bash
firebase deploy --only firestore:rules
```

### Step 5: Test with Emulator

```bash
firebase emulators:start
```

---

## ✅ Validation Checklist

### Before Deployment

- [ ] All helper functions defined and tested
- [ ] Each collection has appropriate rules
- [ ] Subcollections properly protected
- [ ] User authentication required where needed
- [ ] Admin-only operations protected
- [ ] Catch-all rule denies by default
- [ ] Tests pass with emulator
- [ ] Rules mirror service-layer permissions
- [ ] No security gaps identified

### After Deployment

- [ ] Staging environment receives rules
- [ ] Production functions still work
- [ ] No unexpected permission errors
- [ ] Audit logs show correct access patterns
- [ ] Admin operations still functional

---

## 🎯 Task Breakdown for Day 2

### Task 1: Create Rules File (1 hour)
- ✅ firestore.rules created
- Include all collections and subcollections
- Define all helper functions
- Add comprehensive comments

### Task 2: Create Test Suite (1.5 hours)
- [ ] Test user access permissions
- [ ] Test household access permissions
- [ ] Test shift access permissions
- [ ] Test message access permissions
- [ ] Test invitation access permissions

### Task 3: Test with Emulator (2 hours)
- [ ] Setup Firebase Emulator
- [ ] Run test suite against emulator
- [ ] Verify all rules working correctly
- [ ] Fix any issues found

### Task 4: Validate Against Service Layer (1 hour)
- [ ] Compare firestore rules with service-layer permissions
- [ ] Ensure alignment between layers
- [ ] Document any discrepancies

### Task 5: Documentation & Deployment (0.5 hours)
- [ ] Create deployment guide
- [ ] Document rule behaviors
- [ ] Prepare for staging deployment

---

## 🔄 How Rules Mirror Service-Layer

### Service Layer → Database Layer

**canInviteMember() Service**
```typescript
// Service checks
1. Is user admin?
2. Is subscription tier valid?
3. Is target not already member?
```

**→ Firestore Rule**
```firestore
isHouseholdAdmin(householdId) &&
!isHouseholdMember(target_household)
```

---

**canRemoveMember() Service**
```typescript
// Service checks
1. Is user admin OR removing self?
2. If last admin, cannot remove without transfer
```

**→ Firestore Rule**
```firestore
isHouseholdAdmin(householdId) ||
isOwner(userId)
```

---

**validateShiftPermission() Service**
```typescript
// Service checks
1. User is household member (for household shifts)
2. User is shift owner
3. Check household settings
```

**→ Firestore Rule**
```firestore
canAccessShift() &&
(isShiftOwner || allowMemberEditOthers)
```

---

## 📊 Security Coverage

| Layer | Protection | Status |
|-------|-----------|--------|
| **Service Layer** | RBAC + Enforcement | ✅ Day 1 |
| **Database Layer** | Firestore Rules | ⏳ Day 2 |
| **Client Layer** | Permission UI | ⏳ Week 2 |
| **API Layer** | Rate Limiting | ⏳ Week 2 |

---

## 🚀 Next Steps After Day 2

1. ✅ Deploy Firestore Rules to Firestore
2. ⏳ Monitor production permissions
3. ⏳ Run comprehensive integration tests
4. ⏳ Deploy Week 2: Notifications system
5. ⏳ Deploy Week 2: Payment integration

---

## 📝 Notes

- Rules are default-deny: anything not explicitly allowed is forbidden
- Helper functions reduce rule duplication and improve readability
- Subcollections inherit parent restrictions
- Timestamp validation prevents backdating
- User ID validation prevents impersonation

---

**Day 2 Start Time:** 10:45 PM Oct 19, 2025  
**Expected Completion:** 6 AM Oct 20, 2025  
**Status:** Ready to begin implementation
