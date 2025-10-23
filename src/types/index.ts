/**
 * Core data models for Kinshift
 */

export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Household {
  id: string;
  name: string;
  joinCode: string; // Short 6-8 character code for easy joining
  admins: string[]; // Array of user IDs
  members: string[]; // Array of user IDs
  memberJoinDates?: Record<string, Date>; // Track when each member joined for promotion ordering
  creatorId?: string; // ID of user who created the household
  subscribedTier?: 'free' | 'standard' | 'premium'; // Current tier of the household
  tierSyncedAt?: Date; // Last time tier was synced with admin's subscription
  downgradeWarningAt?: Date; // When downgrade warning was issued (7-day grace period)
  createdAt: Date;
  updatedAt: Date;
  settings?: HouseholdSettings;
}

export interface HouseholdSettings {
  allowMemberEditOthers: boolean; // Can members edit other people's shifts?
  requireApprovalForShifts: boolean; // Do shifts need admin approval?
  notifyOnConflicts: boolean; // Send notifications when conflicts detected?
}

export interface HouseholdMember {
  userId: string;
  name: string;
  email?: string;
  role: 'admin' | 'member';
  joinedAt: Date;
}


export interface Shift {
  id: string;
  householdId?: string; // Optional - for personal mode (individual users without household)
  ownerId: string; // User who created/owns the shift
  title: string; // e.g., "Night Shift", "Doctor Appointment"
  startTime: Date; // ISO timestamp
  endTime: Date; // ISO timestamp
  colorTag: string; // Hex color code (auto-generated based on type)
  shiftType: ShiftType; // Type of shift for color coding
  label?: string; // Display label (e.g., "D", "N", "HOL", "OFF")
  notes?: string; // Additional details, responsibilities, errands
  recurringRule?: RecurringRule; // Optional recurring pattern
  patternRule?: PatternRule; // Work pattern like 4on4off
  splitTimes?: Array<{ startTime: Date; endTime: Date }>; // For split shifts - multiple time ranges in one day
  createdAt: Date;
  updatedAt: Date;
  lastEditedBy: string; // User ID of last editor
  isDeleted?: boolean; // Soft delete flag
}

// Extended shift types for comprehensive shift worker needs
export type ShiftType = 
  | 'day'        // Standard day shift
  | 'night'      // Night shift
  | 'twilight'   // Evening/twilight shift
  | 'split'      // Split shift (multiple shifts per day)
  | 'holiday'    // Holiday/annual leave
  | 'off'        // Scheduled day off
  | 'sick'       // Sick leave
  | 'training'   // Training day
  | 'custom';    // Custom pattern builder

// Legacy types mapped to new types for backward compatibility
export type LegacyShiftType = 'days' | 'nights' | 'afternoons' | 'morning' | 'evening';

export function mapLegacyShiftType(legacy: LegacyShiftType): ShiftType {
  const mapping: Record<LegacyShiftType, ShiftType> = {
    'days': 'day',
    'nights': 'night',
    'afternoons': 'twilight',
    'morning': 'day',
    'evening': 'twilight',
  };
  return mapping[legacy] || 'day';
}

export interface PatternRule {
  type: 'rotation' | 'fixed_weekly' | 'custom';
  // For rotation patterns like 4on4off, 2on3off
  workDays?: number; // e.g., 4 for "4 on 4 off"
  restDays?: number; // e.g., 4 for "4 on 4 off"
  startDate: Date; // When the pattern starts
  // For fixed weekly patterns
  weeklySchedule?: {
    monday?: boolean;
    tuesday?: boolean;
    wednesday?: boolean;
    thursday?: boolean;
    friday?: boolean;
    saturday?: boolean;
    sunday?: boolean;
  };
}

export interface RecurringRule {
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  interval: number; // e.g., every 2 weeks
  daysOfWeek?: number[]; // 0-6 for Sun-Sat (for weekly/biweekly)
  endDate?: Date; // When the recurrence stops
  count?: number; // Or stop after N occurrences
}

export interface Invitation {
  id: string;
  inviteCode: string; // Unique 8-character code for invitation links
  householdId: string;
  householdName: string; // Include household name for invitation display
  emailOrPhone: string;
  inviteeName?: string; // Optional name if provided
  role: 'member' | 'admin';
  invitedBy: string; // User ID of inviter
  inviterName: string; // Name of person who sent invite
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: string; // User ID who accepted (may differ from email/phone)
  createdAt: Date;
  updatedAt: Date;
}

// For backward compatibility
export type Invite = Invitation;

export interface ShiftConflict {
  id: string;
  householdId: string;
  shifts: string[]; // Array of conflicting shift IDs
  users: string[]; // Array of user IDs involved
  conflictType: 'overlap' | 'childcare' | 'responsibility';
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string; // User ID who resolved it
}

export interface ShiftMessage {
  id: string;
  shiftId: string;
  householdId: string;
  authorId: string;
  authorName: string;
  message: string;
  isPrivate: boolean; // Private messages only visible to shift owner
  createdAt: Date;
  updatedAt?: Date;
  editedBy?: string;
}

/**
 * Day Note - Plans and events for a specific day
 * Visible to all household members
 * E.g., "Swimming at 6pm", "Dentist appointment"
 */
export interface DayNote {
  id: string;
  householdId?: string; // Optional - personal notes won't have household
  date: string; // YYYY-MM-DD format for consistent querying
  authorId: string;
  authorName: string;
  content: string; // The note text (e.g., "Swimming at 6pm")
  time?: string; // Optional time in HH:mm format (e.g., "18:00")
  category?: 'appointment' | 'event' | 'reminder' | 'childcare' | 'other';
  notifyWorkingMembers: boolean; // If true, notify members working this day (household only)
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
}

/**
 * Day Message - Targeted messages to specific household members on specific days
 * E.g., "Mark - get milk on way home"
 */
export interface DayMessage {
  id: string;
  householdId: string;
  date: string; // YYYY-MM-DD format
  authorId: string;
  authorName: string;
  recipientId: string; // Specific user this message is for
  recipientName: string;
  message: string;
  isRead: boolean;
  readAt?: Date;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  householdId: string;
  type: 
    | 'shift_created' 
    | 'shift_updated' 
    | 'shift_edited' 
    | 'shift_deleted' 
    | 'conflict' 
    | 'conflict_detected'
    | 'invite' 
    | 'invitation_received'
    | 'message' 
    | 'day_message'
    | 'day_note_added'
    | 'shift_reminder'
    | 'shifts_created'
    | 'subscription_downgrade'
    | 'subscription_canceled';
  title: string;
  body: string;
  data?: Record<string, any>; // Additional payload (shiftId, householdId, inviteCode, date, etc.)
  read: boolean;
  createdAt: Date;
}

export interface OfflineEdit {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: 'shifts' | 'households' | 'users';
  documentId: string;
  data: any;
  userId?: string; // User performing the operation
  timestamp: Date;
  synced: boolean;
  retryCount: number;
}

// Navigation types
export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Signup: undefined;
  MainTabs: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  PolicyWebView: { htmlAsset: 'privacy' | 'terms' };
};

export type MainTabsParamList = {
  Calendar: undefined;
  Shifts: undefined;
  Household: {screen?: keyof HouseholdStackParamList; params?: any} | undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type CalendarStackParamList = {
  CalendarView: undefined;
  ShiftDetail: {shiftId: string};
  AddShift: {date?: Date; preSelectPattern?: any}; // preSelectPattern for auto-selecting newly created pattern
  AddShiftPattern: undefined;
  EditShift: {shiftId: string};
  DayDetail: {date: string; shifts?: Shift[]}; // YYYY-MM-DD format, optional pre-loaded shifts
  TwoWeekView: undefined; // 14-day forward view
  PatternBuilder: undefined; // Custom pattern builder screen
};

export type HouseholdStackParamList = {
  HouseholdList: undefined;
  HouseholdDetail: {householdId: string};
  CreateHousehold: undefined;
  JoinHousehold: undefined;
  InviteMembers: {householdId: string};
  ManageMembers: {householdId: string};
  InvitationAccept: {inviteCode: string};
  RoleManagement: {householdId: string; householdName: string};
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  NotificationPreferences: undefined;
  About: undefined;
  Subscription: undefined;
  PlanComparison: undefined;
};

// View modes
export type CalendarViewMode = 'day' | 'week' | 'month';

// Color palette for shifts
export const SHIFT_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#FFE66D', // Yellow
  '#A8E6CF', // Light Green
  '#C7CEEA', // Lavender
  '#FF9999', // Pink
  '#B4A7D6', // Purple
] as const;

export type ShiftColor = typeof SHIFT_COLORS[number];
