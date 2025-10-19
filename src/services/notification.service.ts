// Stub notification service for test build
// TODO: Implement using Expo Notifications instead of React Native Firebase

export const notificationService = {
  initialize: async (userId: string) => {
    console.log('[Stub] Notification service initialized for user:', userId);
  },
  
  cleanup: () => {
    console.log('[Stub] Notification service cleanup');
  },
  
  checkPermission: async () => {
    console.log('[Stub] Check notification permission');
    return 'granted';
  },
  
  requestPermission: async () => {
    console.log('[Stub] Request notification permission');
    return true;
  },
  
  registerDeviceToken: async (userId: string, householdId: string) => {
    console.log('[Stub] Device token registration', userId, householdId);
  },
  
  getUserNotifications: async (userId: string) => {
    console.log('[Stub] Get user notifications', userId);
    return [];
  },
  
  listenToUserNotifications: (userId: string, callback: any) => {
    console.log('[Stub] Listen to user notifications', userId);
    // Return unsubscribe function
    return () => {
      console.log('[Stub] Unsubscribe from notifications');
    };
  },
  
  markAsRead: async (notificationId: string) => {
    console.log('[Stub] Mark notification as read', notificationId);
  },
  
  markAllAsRead: async (userId: string) => {
    console.log('[Stub] Mark all notifications as read', userId);
  },
  
  deleteNotification: async (notificationId: string) => {
    console.log('[Stub] Delete notification', notificationId);
  },
  
  notifyInvitationAccepted: async (inviterId: string, inviteeName: string, householdName: string) => {
    console.log('[Stub] Notify invitation accepted', inviterId, inviteeName, householdName);
  },
  
  notifyHouseholdDowngrade: async (householdId: string, memberIds: string[], previousTier: string, newTier: string) => {
    console.log('[Stub] Notify household downgrade', householdId, previousTier, newTier);
  },
  
  notifySubscriptionCanceled: async (userId: string, affectedHouseholds: any[]) => {
    console.log('[Stub] Notify subscription canceled', userId, affectedHouseholds.length);
  },
  
  onNotificationReceived: (callback: any) => {
    console.log('[Stub] Notification listener registered');
    return () => {};
  },
  
  sendNotification: async (notification: any) => {
    console.log('[Stub] Send notification', notification);
  },
  
  notifyShiftCreated: async (shift: any, household: any) => {
    console.log('[Stub] Notify shift created', shift, household);
  },
  
  notifyMultipleShiftsCreated: async (shifts: any[], household: any) => {
    console.log('[Stub] Notify multiple shifts created', shifts.length, household);
  }
};