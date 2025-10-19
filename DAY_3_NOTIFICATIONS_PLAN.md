# 🚀 Day 3: Notifications System Implementation Plan

**Date:** October 20, 2025  
**Phase:** Real-Time Notifications  
**Objective:** Full Expo Notifications Integration  
**Estimated Duration:** 8-10 hours

---

## 🎯 Day 3 Objectives

| Task | Hours | Status |
|------|-------|--------|
| 1. Setup Expo Notifications | 1 | ⏳ |
| 2. Create notification service | 2 | ⏳ |
| 3. Implement push tokens | 1.5 | ⏳ |
| 4. Setup notification handlers | 1.5 | ⏳ |
| 5. Create notification templates | 1 | ⏳ |
| 6. Real-time subscriptions | 1.5 | ⏳ |
| 7. Testing & integration | 1 | ⏳ |
| **TOTAL** | **9.5** | ⏳ |

---

## 📋 Notification System Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                   USER ACTIONS                          │
│  (Invite, Create Shift, Send Message, etc.)            │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│         SERVICE LAYER (notification.service.ts)         │
│  - Create notification in Firestore                     │
│  - Log audit trail                                      │
│  - Send push notification (if token available)          │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼─────────┐  ┌────────▼────────────┐
│   Firestore     │  │  Push Notification  │
│   (stored)      │  │  (real-time mobile) │
└─────────────────┘  └────────┬────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Expo Notifications │
                    │  (APNs / FCM)       │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  User's Device      │
                    │  Receives Notif     │
                    └─────────────────────┘
```

---

## 📱 Notification Types

### Type 1: Shift Notifications
```
Event: Shift Created
To: Household members
Title: "New shift assigned"
Body: "Alice created a day shift on Oct 20"
Data: {shiftId, householdId, date}
```

### Type 2: Invitation Notifications
```
Event: User Invited
To: Invited user
Title: "Household invitation"
Body: "You've been invited to Smith Family household"
Data: {householdId, invitationCode}
```

### Type 3: Message Notifications
```
Event: Message Received
To: Shift/day note participants
Title: "New message in shift"
Body: "Alice: Are you still on for tomorrow?"
Data: {shiftId, messageId}
```

### Type 4: Admin Notifications
```
Event: Subscription Downgrade
To: Household admin
Title: "Subscription downgraded"
Body: "Your subscription ended. Limited to 2 members."
Data: {householdId, newTier}
```

### Type 5: Reminders
```
Event: Upcoming Shift
To: Shift owner
Title: "Shift starting soon"
Body: "Your shift starts in 1 hour"
Data: {shiftId, startTime}
```

---

## 🛠️ Implementation Steps

### Step 1: Install Expo Notifications (1 hour)

#### 1.1 Install Package
```bash
npm install expo-notifications
npx expo install expo-notifications
```

#### 1.2 Configure app.json
```json
{
  "plugins": [
    [
      "expo-notifications",
      {
        "icon": "./assets/notification-icon.png",
        "color": "#ffffff",
        "sounds": [
          "./assets/notification-sound.wav"
        ]
      }
    ]
  ]
}
```

#### 1.3 Setup Permissions
- Request notification permissions on app start
- Store push token in Firestore
- Handle permission denied gracefully

### Step 2: Create Notification Service (2 hours)

#### 2.1 Push Token Management
```typescript
// Store token for user
async registerPushToken(userId: string, token: string)

// Get user's push tokens
async getUserTokens(userId: string): Promise<string[]>

// Remove token when logging out
async unregisterPushToken(userId: string, token: string)
```

#### 2.2 Notification Storage
```typescript
// Save notification to Firestore
async createNotification(notification: Notification): Promise<string>

// Fetch user's notifications
async getUserNotifications(userId: string): Promise<Notification[]>

// Listen to real-time notifications
listenToUserNotifications(userId: string, callback: Function)
```

#### 2.3 Notification Sending
```typescript
// Send to single device
async sendPushNotification(token: string, notification: {title, body})

// Send to all household members
async notifyHousehold(householdId: string, notification: Notification)

// Send to specific user
async notifyUser(userId: string, notification: Notification)
```

### Step 3: Push Token Management (1.5 hours)

#### 3.1 Token Registration
```typescript
// On app launch
- Request notification permission
- Get push token from Expo
- Store in Firestore under user document
- Listen for token changes
```

#### 3.2 Token Updates
```typescript
// When app comes to foreground
- Verify token still valid
- Update last seen time
- Refresh if needed
```

#### 3.3 Token Cleanup
```typescript
// On logout
- Remove token from Firestore
- Unsubscribe from notifications
```

### Step 4: Notification Handlers (1.5 hours)

#### 4.1 Foreground Handler
```typescript
// App is open, notification arrives
- Show in-app notification badge
- Update notification list
- Play sound/vibration
```

#### 4.2 Background Handler
```typescript
// App is closed, notification arrives
- Expo handles display
- User taps notification
- Open app to correct screen
```

#### 4.3 Deep Linking
```typescript
// Notification tapped while app closed
- Parse notification data
- Navigate to relevant screen
- Show context (shift, household, etc.)
```

### Step 5: Notification Templates (1 hour)

#### 5.1 Shift Notifications
```
Title: "{userName} created {shiftType} shift"
Body: "{date} • {household}"
```

#### 5.2 Invitation Notifications
```
Title: "You're invited to {household}"
Body: "Join {memberCount} members"
```

#### 5.3 Message Notifications
```
Title: "New message from {userName}"
Body: "{messagePreview}..."
```

#### 5.4 Admin Notifications
```
Title: "Subscription update"
Body: "{previousTier} → {newTier}"
```

### Step 6: Real-Time Subscriptions (1.5 hours)

#### 6.1 Firestore Subscriptions
```typescript
// Listen to user's notifications
db.collection('notifications')
  .where('userId', '==', currentUserId)
  .where('read', '==', false)
  .onSnapshot(callback)
```

#### 6.2 Update Handlers
```typescript
// When notification received
- Update UI notification count
- Add to notification list
- Trigger sound/vibration
```

#### 6.3 Mark as Read
```typescript
// User taps notification
- Update read flag in Firestore
- Remove from badge count
- Clear notification list update
```

### Step 7: Testing & Integration (1 hour)

#### 7.1 Manual Testing
- [ ] Create shift → notification sent
- [ ] Send invitation → notification received
- [ ] Tap notification → correct screen
- [ ] Background → foreground handling
- [ ] Multiple devices same user

#### 7.2 Integration Testing
- [ ] Permission handling
- [ ] Token management
- [ ] Firestore sync
- [ ] Error handling

---

## 📝 Current State Analysis

### Existing Infrastructure
✅ Notification types defined (13 types)
✅ Firestore collection ready
✅ Stub service methods in place
✅ UI screens ready (NotificationsScreen)
✅ Permission preferences screen exists

### What Needs Implementation
⏳ Expo Notifications setup
⏳ Push token management
⏳ Real notification sending
⏳ Firestore integration
⏳ Handlers for received notifications

---

## 🔄 Integration Points

### When Notifications Should Fire

| Trigger | Who Receives | Type |
|---------|--------------|------|
| Shift Created | Household members | shift_created |
| Shift Deleted | Household members | shift_deleted |
| User Invited | Invited user | invite |
| Message Sent | Participants | message |
| Subscription Changed | Admin | subscription_changed |
| Downgrade Warning | Admin | downgrade_warning |
| Shift Reminder | Owner | shift_reminder |

---

## 🧪 Test Scenarios

### Scenario 1: Single User, Multiple Devices
```
1. User logs in on iPhone
2. Get push token #1, store in Firestore
3. User logs in on iPad
4. Get push token #2, store in Firestore
5. Admin creates shift
6. Both devices should receive notification
```

### Scenario 2: Permission Denied
```
1. User denies notification permission
2. App should handle gracefully
3. No push tokens stored
4. Notifications still available in Firestore (just not pushed)
```

### Scenario 3: Background to Foreground
```
1. App in background
2. Notification arrives
3. User taps notification
4. App opens to correct screen
5. Notification marked as read
```

---

## ⚠️ Edge Cases to Handle

| Case | Solution |
|------|----------|
| User has old invalid token | Retry with new token on next notification |
| Push service unavailable | Fall back to Firestore only |
| User logs out on one device | Remove that device's token |
| Multiple notifications quickly | Batch and deduplicate |
| Network offline | Queue and send when online |

---

## 📊 Success Criteria

✅ User receives push notification within 5 seconds of trigger event  
✅ Tapping notification opens correct screen  
✅ App handles notifications while backgrounded  
✅ App handles notifications while foregrounded  
✅ Token management is automatic and transparent  
✅ Notifications persist in Firestore  
✅ Tests pass with Firebase Emulator  
✅ No permission errors in production  

---

## 🚀 Rollout Strategy

### Phase 1: Development
1. Setup Expo Notifications locally
2. Test with test accounts
3. Verify token management
4. Test all notification types

### Phase 2: Staging
1. Deploy to staging app
2. Test with real devices
3. Monitor token management
4. Verify Firestore sync

### Phase 3: Production
1. Deploy to production
2. Monitor error rates
3. Watch for token issues
4. Gather user feedback

---

## 📚 Files to Create/Modify

### New Files
```
src/services/notification.service.ts (rewrite)
src/utils/notificationTemplates.ts (new)
src/utils/pushTokenManager.ts (new)
```

### Modified Files
```
src/types/index.ts (add PushToken type)
src/config/firebase.config.ts (update collection refs)
src/contexts/AuthContext.tsx (add notification setup)
src/screens/notifications/NotificationsScreen.tsx (add real data)
app.json (add expo-notifications config)
```

---

## 📈 Metrics to Track

- Push token registration rate
- Notification delivery rate
- Notification open rate
- Permission denial rate
- Error rate
- Performance impact

---

## 🎯 By End of Day 3

- ✅ Expo Notifications installed and configured
- ✅ Push token management working
- ✅ Notification service fully implemented
- ✅ Real notifications being sent and received
- ✅ Deep linking working
- ✅ Tests passing
- ✅ Documentation updated
- ✅ Ready for staging deployment

---

**Start Time:** ~3:30 AM, Oct 20, 2025  
**Target Completion:** ~12:30 PM, Oct 20, 2025  
**Status:** Ready to begin implementation
