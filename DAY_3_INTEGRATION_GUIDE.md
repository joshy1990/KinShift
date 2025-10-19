# Day 3 Phase 4: Integration Implementation Guide

## Quick Start: Wire Up Notifications in 4 Steps

### Step 1: AuthContext Integration (15 minutes)

Update `src/contexts/AuthContext.tsx`:

```typescript
import { useNotificationSetup } from '@/utils/notificationIntegration';
import { useNavigation } from '@react-navigation/native';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigation = useNavigation();

  // Add this hook
  useNotificationSetup(user?.id, (deepLink) => {
    // Handle notification navigation
    navigation.navigate(...parseDeepLink(deepLink));
  });

  // ... rest of auth provider
};

// Helper to parse deep links
function parseDeepLink(deepLink: string) {
  if (deepLink.includes('shift/')) {
    const shiftId = deepLink.split('shift/')[1];
    return ['Calendar', { screen: 'ShiftDetail', params: { shiftId } }];
  }
  if (deepLink.includes('invitation/')) {
    const inviteCode = deepLink.split('invitation/')[1];
    return ['Household', { screen: 'InvitationAccept', params: { inviteCode } }];
  }
  if (deepLink.includes('household/')) {
    const householdId = deepLink.split('household/')[1];
    return ['Household', { screen: 'HouseholdDetail', params: { householdId } }];
  }
  if (deepLink.includes('subscription')) {
    return ['Profile', { screen: 'Subscription' }];
  }
  if (deepLink.includes('notifications')) {
    return ['Notifications'];
  }
  return ['Calendar'];
}
```

### Step 2: Create NotificationsScreen (45 minutes)

Create `src/screens/notifications/NotificationsScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNotifications } from '@/utils/notificationIntegration';
import { notificationService } from '@/services/notification.service';
import { Notification } from '@/types';

export const NotificationsScreen = ({ navigation }) => {
  const userId = useAuth().user?.id;
  const { notifications, unreadCount, isLoading } = useNotifications(userId);
  const [refreshing, setRefreshing] = useState(false);

  const handleMarkAsRead = async (notificationId: string, read: boolean) => {
    if (!read) {
      await notificationService.markAsRead(notificationId);
    }
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead(userId);
  };

  const handleDelete = async (notificationId: string) => {
    await notificationService.deleteNotification(notificationId);
  };

  const handleNotificationPress = (notification: Notification) => {
    handleMarkAsRead(notification.id, notification.read);

    // Navigate based on notification type
    const data = notification.data || {};
    if (notification.type.includes('shift')) {
      navigation.navigate('Calendar', {
        screen: 'ShiftDetail',
        params: { shiftId: data.shiftId },
      });
    } else if (notification.type.includes('invite')) {
      navigation.navigate('Household', {
        screen: 'InvitationAccept',
        params: { inviteCode: data.invitationCode },
      });
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.read && styles.unread]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.time}>
          {new Date(item.createdAt as any).toLocaleString()}
        </Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item.id)}>
        <Text style={styles.deleteButton}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity
          style={styles.markAllRead}
          onPress={handleMarkAllAsRead}
        >
          <Text style={styles.markAllReadText}>
            Mark all {unreadCount} as read
          </Text>
        </TouchableOpacity>
      )}

      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          refreshing={refreshing}
          onRefresh={() => setRefreshing(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  unread: {
    backgroundColor: '#f0f7ff',
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    fontSize: 20,
    color: '#999',
    padding: 8,
  },
  markAllRead: {
    padding: 12,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  markAllReadText: {
    color: '#0066cc',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
```

### Step 3: Update Shift Creation Flow (20 minutes)

In `src/services/shift.service.ts`, after creating a shift:

```typescript
import { notificationService } from '@/services/notification.service';

export const createShift = async (shiftData, householdId: string) => {
  try {
    // Create shift in Firestore
    const shiftRef = collection(db, 'households', householdId, 'shifts');
    const docRef = await addDoc(shiftRef, {
      ...shiftData,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastEditedBy: getCurrentUserId(),
    });

    const shift = { id: docRef.id, ...shiftData };

    // Send notifications to household members
    const household = await getHousehold(householdId);
    const currentUser = await getCurrentUser();
    
    await notificationService.notifyShiftCreated(
      shift,
      household,
      currentUser.name
    );

    return shift;
  } catch (error) {
    console.error('Error creating shift:', error);
    throw error;
  }
};
```

### Step 4: Update Invitation Flow (15 minutes)

In `src/services/invitation.service.ts`, after sending invitation:

```typescript
import { notificationService } from '@/services/notification.service';

export const sendInvitation = async (
  householdId: string,
  inviteEmail: string,
  inviteeName: string
) => {
  try {
    // Create invitation in Firestore
    const invitation = {
      inviteCode: generateInviteCode(),
      householdId,
      emailOrPhone: inviteEmail,
      inviteeName,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, 'invitations'), invitation);

    // If user with this email exists, send them a notification
    const invitedUser = await getUserByEmail(inviteEmail);
    if (invitedUser) {
      const household = await getHousehold(householdId);
      await notificationService.notifyInvitationAccepted(
        invitedUser.id,
        householdId,
        household.name,
        household.members.length
      );
    }

    return { id: docRef.id, ...invitation };
  } catch (error) {
    console.error('Error sending invitation:', error);
    throw error;
  }
};
```

## Testing Checklist

Before moving to Day 4, verify:

- [ ] App launches without errors
- [ ] Notifications initialize on login
- [ ] NotificationsScreen shows notifications
- [ ] Mark as read works
- [ ] Delete notification works
- [ ] Deep linking navigates correctly
- [ ] Shift creation triggers notification
- [ ] Multiple devices receive notifications
- [ ] Permissions are requested and handled
- [ ] Errors are handled gracefully

## Common Issues & Fixes

### Issue: "Cannot find module notificationIntegration"
**Fix**: Check file path in imports
```typescript
// Correct
import { useNotificationSetup } from '@/utils/notificationIntegration';
```

### Issue: "useNotifications returns undefined"
**Fix**: Ensure userId is defined before using hook
```typescript
const userId = useAuth().user?.id;
if (!userId) return null;
const { notifications } = useNotifications(userId);
```

### Issue: "Deep link not navigating"
**Fix**: Verify deep link format in parseDeepLink function

### Issue: "Notification not appearing in NotificationsScreen"
**Fix**: Check real-time listener setup in useNotificationSetup

## Performance Tips

1. **Lazy load notifications**: Only load recent notifications initially
2. **Virtualize lists**: Use FlatList for large notification lists
3. **Debounce updates**: Batch rapid notification updates
4. **Cache tokens**: Already implemented in pushTokenManager

## Next: Day 4

After completing integration and testing:
- Move to **Day 4-5: Payment System Integration (RevenueCat)**
- Estimated: 6-8 hours
- Includes: Subscription setup, tier enforcement, billing

---

**Time Estimate**: 4-5 hours total
**Current Status**: Core code ready, awaiting integration
**Next Check-in**: After NotificationsScreen integration
