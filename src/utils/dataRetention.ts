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
 */
export async function runRetentionCleanupIfDue(): Promise<void> {
  try {
    // Lazy-import AsyncStorage to avoid circular deps at module load
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

    const last = await AsyncStorage.getItem(LAST_CLEANUP_KEY);
    if (last && Date.now() - Number(last) < CLEANUP_INTERVAL_MS) {
      return; // Already ran today
    }

    console.log('[DataRetention] Starting daily cleanup…');

    const results = await Promise.allSettled([
      shiftService.purgeSoftDeletedShifts(30),
      dayNoteService.purgeSoftDeletedNotes(30),
      invitationService.purgeExpiredInvitations(7),
      auditService.runRetentionCleanup(),
    ]);

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const labels = ['shifts', 'dayNotes', 'invitations', 'audit'];
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
