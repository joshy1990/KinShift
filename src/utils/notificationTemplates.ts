/**
 * Notification Templates
 * Central place for all notification message formatting
 */

import { Notification } from '@/types';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * Template for shift creation notifications
 */
export const shiftCreatedTemplate = (
  creatorName: string,
  shiftType: string,
  date: string,
  householdName: string,
  shiftId: string
): NotificationPayload => ({
  title: `New shift from ${creatorName}`,
  body: `${shiftType} shift on ${date} • ${householdName}`,
  data: {
    type: 'shift_created',
    shiftId,
    actionUrl: `/shift/${shiftId}`,
  },
});

/**
 * Template for shift update notifications
 */
export const shiftUpdatedTemplate = (
  updaterName: string,
  shiftType: string,
  date: string,
  householdName: string,
  shiftId: string
): NotificationPayload => ({
  title: `Shift updated by ${updaterName}`,
  body: `${shiftType} shift on ${date} • ${householdName}`,
  data: {
    type: 'shift_updated',
    shiftId,
    actionUrl: `/shift/${shiftId}`,
  },
});

/**
 * Template for shift deletion notifications
 */
export const shiftDeletedTemplate = (
  deleterName: string,
  shiftType: string,
  date: string,
  householdName: string
): NotificationPayload => ({
  title: `Shift deleted by ${deleterName}`,
  body: `${shiftType} shift on ${date} was removed from ${householdName}`,
  data: {
    type: 'shift_deleted',
  },
});

/**
 * Template for shift conflict notifications
 */
export const shiftConflictTemplate = (
  date: string,
  householdName: string
): NotificationPayload => ({
  title: 'Schedule conflict detected',
  body: `You have overlapping shifts on ${date} in ${householdName}`,
  data: {
    type: 'conflict_detected',
  },
});

/**
 * Template for invitation notifications
 */
export const invitationTemplate = (
  householdName: string,
  memberCount: number,
  invitationCode: string,
  householdId: string
): NotificationPayload => ({
  title: `You're invited to ${householdName}`,
  body: `Join ${memberCount} other member${memberCount !== 1 ? 's' : ''}`,
  data: {
    type: 'invitation_received',
    householdId,
    invitationCode,
    actionUrl: `/invite/${invitationCode}`,
  },
});

/**
 * Template for message notifications
 */
export const messageTemplate = (
  senderName: string,
  messagePreview: string,
  shiftId: string
): NotificationPayload => ({
  title: `Message from ${senderName}`,
  body: messagePreview.substring(0, 100),
  data: {
    type: 'message',
    shiftId,
    actionUrl: `/shift/${shiftId}`,
  },
});

/**
 * Template for day note message notifications
 */
export const dayNoteMessageTemplate = (
  senderName: string,
  messagePreview: string,
  date: string,
  dayNoteId: string
): NotificationPayload => ({
  title: `Message from ${senderName}`,
  body: messagePreview.substring(0, 100),
  data: {
    type: 'day_message',
    dayNoteId,
    date,
    actionUrl: `/day/${date}`,
  },
});

/**
 * Template for day note added notifications
 */
export const dayNoteAddedTemplate = (
  authorName: string,
  date: string,
  dayNoteId: string
): NotificationPayload => ({
  title: `${authorName} added a day note`,
  body: `Check what happened on ${date}`,
  data: {
    type: 'day_note_added',
    dayNoteId,
    date,
    actionUrl: `/day/${date}`,
  },
});

/**
 * Template for subscription downgrade notifications
 */
export const subscriptionDowngradeTemplate = (
  previousTier: string,
  newTier: string,
  householdName: string,
  householdId: string
): NotificationPayload => ({
  title: 'Subscription downgraded',
  body: `${householdName}: ${previousTier} → ${newTier}. Limited to 2 members.`,
  data: {
    type: 'subscription_downgrade',
    householdId,
    newTier,
    actionUrl: `/household/${householdId}`,
  },
});

/**
 * Template for subscription cancellation notifications
 */
export const subscriptionCanceledTemplate = (
  affectedCount: number,
  firstHouseholdName: string
): NotificationPayload => ({
  title: 'Subscription canceled',
  body: `${affectedCount} household${affectedCount !== 1 ? 's' : ''} affected. Check your settings.`,
  data: {
    type: 'subscription_canceled',
    actionUrl: '/settings/subscription',
  },
});

/**
 * Template for shift reminder notifications
 */
export const shiftReminderTemplate = (
  shiftType: string,
  startTime: Date,
  householdName: string,
  shiftId: string
): NotificationPayload => {
  const timeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return {
    title: `Shift starting soon`,
    body: `Your ${shiftType} shift starts at ${timeStr} • ${householdName}`,
    data: {
      type: 'shift_reminder',
      shiftId,
      startTime: startTime.toISOString(),
      actionUrl: `/shift/${shiftId}`,
    },
  };
};

/**
 * Template for general notifications
 */
export const genericTemplate = (
  title: string,
  body: string,
  type: string,
  data?: Record<string, any>
): NotificationPayload => ({
  title,
  body,
  data: {
    type,
    ...data,
  },
});

/**
 * Convert template to Firestore notification document
 */
export const templateToNotification = (
  userId: string,
  householdId: string,
  payload: NotificationPayload,
  notificationType: Notification['type'],
  senderId?: string
): Omit<Notification, 'id'> => ({
  userId,
  senderId: senderId || undefined,
  householdId,
  type: notificationType,
  title: payload.title,
  body: payload.body,
  data: payload.data,
  read: false,
  createdAt: new Date(),
});
