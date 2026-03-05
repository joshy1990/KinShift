/**
 * Data Retention — runs lightweight cleanup tasks on app start.
 *
 * All operations are fire-and-forget with individual try/catch so a
 * single failure never blocks the others or the rest of app initialization.
 *
 * Retention policy:
 *  - Soft-deleted shifts:       hard-delete after 30 days
 *  - Soft-deleted day notes:    hard-delete after 30 days
 *  - Expired/cancelled invites: hard-delete 7 days past expiry
 *  - Audit logs:                hard-delete after 90 days
 *  - Security events:           hard-delete after 365 days
 */

import { shiftService } from '@/services/shift.service';
import { dayNoteService } from '@/services/dayNote.service';
import { invitationService } from '@/services/invitation.service';
import { auditService } from '@/services/audit.service';

const LAST_CLEANUP_KEY = 'kinshift_last_retention_cleanup';
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

/**
 * Run all retention cleanup jobs if enough time has elapsed since the last run.
 * Safe to call on every app launch — it no-ops if < 24 h since last cleanup.
 *
 * @param userId – The authenticated user's ID. Audit / security-event cleanup
 *   is scoped to this user (Firestore rules enforce userId ownership).
 *   If omitted, audit cleanup is skipped (runs only when user is known).
 */
export async function runRetentionCleanupIfDue(userId?: string): Promise<void> {
  try {
    // Lazy-import AsyncStorage to avoid circular deps at module load
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

    const last = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
    if (last && Date.now() - Number(last) < CLEANUP_INTERVAL_MS) {
      return; // Already ran today
    }

    console.log('[DataRetention] Starting daily cleanup…');

    const jobs: Promise<any>[] = [
      shiftService.purgeSoftDeletedShifts(30),
      dayNoteService.purgeSoftDeletedNotes(30),
      invitationService.purgeExpiredInvitations(7),
    ];
    if (userId) {
      jobs.push(auditService.runRetentionCleanup(userId));
    }

    const results = await Promise.allSettled(jobs);

    const labels = ['shifts', 'dayNotes', 'invitations', ...(userId ? ['audit'] : [])];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[DataRetention] ${labels[i]} cleanup failed:`, r.reason);
      }
    });

    await AsyncStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()));
    console.log('[DataRetention] Daily cleanup complete');
  } catch (error) {
    // Non-critical — log and move on
    console.warn('[DataRetention] Could not run cleanup:', error);
  }
}
