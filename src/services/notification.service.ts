// Stub notification service for test build
// TODO: Implement using Expo Notifications instead of React Native Firebase

export const notificationService = {
  initialize: async (userId: string) => {
    // Stub notification service
  },
  
  cleanup: () => {
    // Stub notification service
  },
  
  checkPermission: async () => {
    return 'granted';
  },
  
  requestPermission: async () => {
    return true;
  },
  
  registerDeviceToken: async (userId: string, householdId: string) => {
    // Stub notification service
  },
  
  getUserNotifications: async (userId: string) => {
    return [];
  },
  
  listenToUserNotifications: (userId: string, callback: any) => {
    // Return unsubscribe function
    return () => {
      // Unsubscribe
    };
  },
  
  markAsRead: async (notificationId: string) => {
    // Stub notification service
  },
  
  markAllAsRead: async (userId: string) => {
    // Stub notification service
  },
  
  deleteNotification: async (notificationId: string) => {
    // Stub notification service
  },
  
  notifyInvitationAccepted: async (inviterId: string, inviteeName: string, householdName: string) => {
    // Stub notification service
  },
  
  notifyHouseholdDowngrade: async (householdId: string, memberIds: string[], previousTier: string, newTier: string) => {
    // Stub notification service
  },
  
  notifySubscriptionCanceled: async (userId: string, affectedHouseholds: any[]) => {
    // Stub notification service
  },
  
  onNotificationReceived: (callback: any) => {
    return () => {};
  },
  
  sendNotification: async (notification: any) => {
    // Stub notification service
  },
  
  notifyShiftCreated: async (shift: any, household: any) => {
    // Stub notification service
  },
  
  notifyMultipleShiftsCreated: async (shifts: any[], household: any) => {
    // Stub notification service
  }
};
