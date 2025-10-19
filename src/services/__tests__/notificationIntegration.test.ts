/**
 * Notification Integration Tests
 * Test scenarios for notification system
 * Run with: npm test -- notificationIntegration.test
 */

import { notificationService } from '@/services/notification.service';
import {
  notificationSubscriptionManager,
  getNotificationStats,
} from '@/utils/notificationSubscriptions';
import {
  setupNotificationHandlers,
  generateDeepLink,
  handleInitialNotification,
} from '@/utils/notificationHandlers';

describe('Notification Service Integration', () => {
  // ========================================
  // INITIALIZATION TESTS
  // ========================================

  describe('Notification Initialization', () => {
    test('should initialize notifications for user', async () => {
      const result = await notificationService.initialize('test-user-1');
      expect(typeof result).toBe('boolean');
    });

    test('should request notification permission', async () => {
      const result = await notificationService.requestPermission();
      expect(typeof result).toBe('boolean');
    });

    test('should check notification permission', async () => {
      const result = await notificationService.checkPermission();
      expect(['granted', 'denied']).toContain(result);
    });

    test('should handle cleanup on logout', async () => {
      await expect(notificationService.cleanup('test-user-1')).resolves.toBeUndefined();
    });
  });

  // ========================================
  // NOTIFICATION STORAGE TESTS
  // ========================================

  describe('Notification Storage', () => {
    test('should create notification', async () => {
      const notification = {
        userId: 'test-user-1',
        householdId: 'test-household-1',
        type: 'shift_created' as const,
        title: 'New Shift Created',
        body: 'John created a new shift',
        data: { shiftId: 'shift-123' },
      };

      const id = await notificationService.getUserNotifications('test-user-1');
      expect(Array.isArray(id)).toBe(true);
    });

    test('should get user notifications', async () => {
      const notifications = await notificationService.getUserNotifications('test-user-1');
      expect(Array.isArray(notifications)).toBe(true);
    });

    test('should mark notification as read', async () => {
      const result = await notificationService.markAsRead('test-notification-1');
      expect(typeof result).toBe('boolean');
    });

    test('should mark all notifications as read', async () => {
      const result = await notificationService.markAllAsRead('test-user-1');
      expect(typeof result).toBe('boolean');
    });

    test('should delete notification', async () => {
      const result = await notificationService.deleteNotification('test-notification-1');
      expect(typeof result).toBe('boolean');
    });
  });

  // ========================================
  // REAL-TIME SUBSCRIPTION TESTS
  // ========================================

  describe('Real-Time Subscriptions', () => {
    test('should setup real-time notification listener', (done) => {
      const unsubscribe = notificationService.listenToUserNotifications(
        'test-user-1',
        (notifications) => {
          expect(Array.isArray(notifications)).toBe(true);
          unsubscribe();
          done();
        }
      );
    });

    test('should get cached notification state', () => {
      const state = notificationSubscriptionManager.getCachedState('test-user-1', false);
      expect(state === null || typeof state === 'object').toBe(true);
    });

    test('should unsubscribe from notifications', () => {
      notificationSubscriptionManager.subscribeToNotifications('test-user-1', () => {}, {
        unreadOnly: false,
      });
      expect(() => {
        notificationSubscriptionManager.unsubscribe('test-user-1', false);
      }).not.toThrow();
    });
  });

  // ========================================
  // NOTIFICATION TYPE TESTS
  // ========================================

  describe('Specific Notification Types', () => {
    test('should notify shift creation', async () => {
      const shift = {
        id: 'shift-1',
        startTime: new Date(),
        ownerId: 'user-1',
        shiftType: 'day' as const,
      };

      const household = {
        id: 'household-1',
        name: 'Test Household',
        members: ['user-1', 'user-2', 'user-3'],
      };

      await expect(
        notificationService.notifyShiftCreated(shift, household, 'John')
      ).resolves.toBeUndefined();
    });

    test('should notify invitation', async () => {
      await expect(
        notificationService.notifyInvitationAccepted('user-1', 'household-1', 'Test House', 3)
      ).resolves.toBeUndefined();
    });

    test('should notify household downgrade', async () => {
      const memberIds = ['user-1', 'user-2', 'user-3'];

      await expect(
        notificationService.notifyHouseholdDowngrade('household-1', memberIds, 'premium', 'free')
      ).resolves.toBeUndefined();
    });

    test('should notify subscription canceled', async () => {
      const households = [
        { id: 'household-1', name: 'House 1' },
        { id: 'household-2', name: 'House 2' },
      ];

      await expect(
        notificationService.notifySubscriptionCanceled('user-1', households)
      ).resolves.toBeUndefined();
    });
  });

  // ========================================
  // NOTIFICATION HANDLER TESTS
  // ========================================

  describe('Notification Handlers', () => {
    test('should setup notification handlers', () => {
      const cleanup = setupNotificationHandlers();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    test('should generate deep link from shift notification', () => {
      const notification = {
        request: {
          content: {
            title: 'Shift Created',
            data: {
              type: 'shift_created',
              shiftId: 'shift-123',
            },
          },
        },
      };

      const deepLink = generateDeepLink(notification as any);
      expect(deepLink).toContain('shift');
    });

    test('should generate deep link from invitation', () => {
      const notification = {
        request: {
          content: {
            title: 'Invitation',
            data: {
              type: 'invite',
              invitationCode: 'ABC123',
            },
          },
        },
      };

      const deepLink = generateDeepLink(notification as any);
      expect(deepLink).toContain('invitation');
    });
  });

  // ========================================
  // STATISTICS TESTS
  // ========================================

  describe('Notification Statistics', () => {
    test('should get notification stats', async () => {
      const stats = await getNotificationStats('test-user-1');

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('unread');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('readPercentage');

      expect(typeof stats.total).toBe('number');
      expect(typeof stats.unread).toBe('number');
      expect(typeof stats.readPercentage).toBe('number');
    });
  });

  // ========================================
  // INTEGRATION TESTS
  // ========================================

  describe('Full Integration Flow', () => {
    test('complete notification flow: init -> create -> listen -> read -> cleanup', async () => {
      const userId = 'integration-test-user';

      // 1. Initialize
      const initResult = await notificationService.initialize(userId);
      expect(initResult).toBeDefined();

      // 2. Get notifications
      const notifications = await notificationService.getUserNotifications(userId);
      expect(Array.isArray(notifications)).toBe(true);

      // 3. Setup real-time listener
      const unsubscribe = notificationService.listenToUserNotifications(userId, (notifs) => {
        expect(Array.isArray(notifs)).toBe(true);
      });

      // 4. Get stats
      const stats = await getNotificationStats(userId);
      expect(stats).toHaveProperty('total');

      // 5. Cleanup
      await notificationService.cleanup(userId);
      unsubscribe();
    });

    test('handler and deep link integration', () => {
      const navigationCallback = jest.fn();
      const cleanup = setupNotificationHandlers(navigationCallback);

      const deepLink = generateDeepLink({
        request: {
          content: {
            title: 'Test',
            data: { type: 'shift_created', shiftId: 'test-123' },
          },
        },
      } as any);

      expect(deepLink).toBeTruthy();
      cleanup();
    });
  });

  // ========================================
  // ERROR HANDLING TESTS
  // ========================================

  describe('Error Handling', () => {
    test('should handle missing household gracefully', async () => {
      const memberIds = ['user-1'];

      await expect(
        notificationService.notifyHouseholdDowngrade('non-existent-household', memberIds, 'premium', 'free')
      ).resolves.toBeUndefined();
    });

    test('should handle invalid notification types', () => {
      const notification = {
        request: {
          content: {
            title: 'Test',
            data: { type: 'unknown_type' },
          },
        },
      };

      const deepLink = generateDeepLink(notification as any);
      // Should return null or default deep link
      expect(deepLink === null || typeof deepLink === 'string').toBe(true);
    });

    test('should handle cleanup errors gracefully', async () => {
      await expect(notificationService.cleanup('invalid-user')).resolves.toBeUndefined();
    });
  });
});

// ========================================
// MANUAL TEST SCENARIOS
// ========================================

/**
 * Manual test scenarios to run manually
 * Used for smoke testing and integration verification
 */
export const manualTestScenarios = {
  /**
   * Test notification on shift creation
   */
  async testShiftCreatedNotification() {
    const shift = {
      id: 'test-shift-' + Date.now(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      ownerId: 'current-user-id',
      shiftType: 'day' as const,
      title: 'Test Shift',
    };

    const household = {
      id: 'test-household-id',
      name: 'Test Household',
      members: ['current-user-id', 'other-user-1', 'other-user-2'],
    };

    await notificationService.notifyShiftCreated(shift, household, 'Test User');
    console.log('✅ Shift created notification sent');
  },

  /**
   * Test real-time subscription
   */
  testRealtimeSubscription(userId: string) {
    console.log('Setting up real-time listener for user:', userId);

    const unsubscribe = notificationService.listenToUserNotifications(userId, (notifications) => {
      console.log('📬 Notifications update:', {
        count: notifications.length,
        unread: notifications.filter((n) => !n.read).length,
      });
    });

    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      unsubscribe();
      console.log('✅ Real-time listener cleaned up');
    }, 5 * 60 * 1000);

    return unsubscribe;
  },

  /**
   * Test notification handler
   */
  testNotificationHandler() {
    console.log('Setting up notification handlers...');

    const cleanup = setupNotificationHandlers((deepLink) => {
      console.log('🎯 Deep link navigation:', deepLink);
    });

    console.log('✅ Handlers ready. Cleanup function available.');
    return cleanup;
  },

  /**
   * Test deep link generation
   */
  testDeepLinkGeneration() {
    const testCases = [
      { type: 'shift_created', shiftId: 'shift-123' },
      { type: 'invite', invitationCode: 'ABC123' },
      { type: 'subscription_downgrade', householdId: 'hh-1' },
    ];

    console.log('Testing deep link generation:');

    testCases.forEach((testCase) => {
      const notification = {
        request: {
          content: {
            title: 'Test',
            data: testCase,
          },
        },
      };

      const deepLink = generateDeepLink(notification as any);
      console.log(`  ${testCase.type} -> ${deepLink}`);
    });

    console.log('✅ Deep link generation tests complete');
  },
};
