/**
 * Calendar Export Service
 * Generates ICS (iCalendar) files from shifts and shares them via the native share sheet.
 *
 * ICS spec: RFC 5545
 */

import { File as ExpoFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Shift, ShiftType } from '@/types';
import { shiftService } from './shift.service';
import { subscriptionService } from './subscription.service';
import { track } from '@/utils/telemetry';

/**
 * Hard cap on the number of shifts we fetch for a single export.
 * Prevents runaway Firestore reads for heavy users / large households.
 * 2 000 shifts ≈ ~5.5 shifts/day for a year — generous for any realistic use.
 */
const MAX_EXPORT_SHIFTS = 2_000;

/**
 * Maximum date range allowed for a single export (in days).
 * Enforced server-side as a safety net on top of the UI presets.
 */
const MAX_EXPORT_RANGE_DAYS = 400;

export interface ExportOptions {
  /** 'personal' exports only the user's shifts; 'household' exports all members */
  scope: 'personal' | 'household';
  startDate: Date;
  endDate: Date;
  householdId?: string;
  userId: string;
  /** Name used in the calendar file metadata */
  calendarName?: string;
}

export interface ExportResult {
  success: boolean;
  shiftCount: number;
  error?: string;
}

// ────────────────── ICS helpers ──────────────────

/** Pad number to 2 digits */
const pad = (n: number): string => n.toString().padStart(2, '0');

/** Format a Date to ICS DATE-TIME (UTC) e.g. 20260213T140000Z */
function toICSDate(d: Date | string | any): string {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) {
    // Fallback — if it's a Firestore Timestamp with seconds/nanoseconds
    if (d && typeof d === 'object' && 'seconds' in d) {
      const fromTs = new Date(d.seconds * 1000);
      return formatUTC(fromTs);
    }
    return formatUTC(new Date());
  }
  return formatUTC(date);
}

function formatUTC(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/** Generate a unique ID for each VEVENT */
function uid(shift: Shift, index?: number): string {
  const suffix = index !== undefined ? `-${index}` : '';
  return `${shift.id}${suffix}@kinshift.app`;
}

/** Fold long ICS lines at 75 octets per RFC 5545 §3.1 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = line.substring(0, 75);
  let pos = 75;
  while (pos < line.length) {
    result += '\r\n ' + line.substring(pos, pos + 74);
    pos += 74;
  }
  return result;
}

/** Escape text values per RFC 5545 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Map ShiftType to a human-readable emoji prefix */
function shiftTypeEmoji(type: ShiftType): string {
  const map: Record<ShiftType, string> = {
    day: '☀️',
    night: '🌙',
    twilight: '🌅',
    split: '🔀',
    holiday: '🏖️',
    off: '😴',
    sick: '🤒',
    training: '📚',
    custom: '⚙️',
  };
  return map[type] || '';
}

// ────────────────── Core export logic ──────────────────

/**
 * Build an ICS VEVENT block for a single shift (or a sub-range of a split shift).
 */
function buildVEvent(
  shift: Shift,
  start: Date | string | any,
  end: Date | string | any,
  splitIndex?: number,
): string {
  const emoji = shiftTypeEmoji(shift.shiftType);
  const summary = `${emoji} ${shift.title}`.trim();
  const description = [
    shift.label ? `Label: ${shift.label}` : '',
    shift.notes || '',
    `Type: ${shift.shiftType}`,
  ]
    .filter(Boolean)
    .join('\\n');

  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid(shift, splitIndex)}`),
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end)}`,
    foldLine(`SUMMARY:${escapeText(summary)}`),
  ];

  if (description) {
    lines.push(foldLine(`DESCRIPTION:${escapeText(description)}`));
  }

  // Map shift type to ICS categories
  lines.push(`CATEGORIES:${shift.shiftType.toUpperCase()}`);

  // Transparency — holidays/off/sick show as FREE, work shifts as BUSY
  const freeTypes: ShiftType[] = ['holiday', 'off', 'sick'];
  lines.push(`TRANSP:${freeTypes.includes(shift.shiftType) ? 'TRANSPARENT' : 'OPAQUE'}`);

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/**
 * Convert an array of Shift objects to an ICS string.
 */
function shiftsToICS(shifts: Shift[], calendarName: string): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KinShift//Calendar Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
  ].join('\r\n');

  const events: string[] = [];

  for (const shift of shifts) {
    if (shift.isDeleted) continue;

    // Split shifts produce one VEVENT per sub-range
    if (shift.shiftType === 'split' && shift.splitTimes && shift.splitTimes.length > 0) {
      shift.splitTimes.forEach((range, idx) => {
        events.push(buildVEvent(shift, range.startTime, range.endTime, idx));
      });
    } else {
      events.push(buildVEvent(shift, shift.startTime, shift.endTime));
    }
  }

  const footer = 'END:VCALENDAR';
  return header + '\r\n' + events.join('\r\n') + '\r\n' + footer + '\r\n';
}

// ────────────────── Public API ──────────────────

class CalendarExportService {
  /**
   * Check if the user's subscription allows calendar export.
   */
  async canExport(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const subscription = await subscriptionService.getUserSubscription(userId);
      if (!subscription) {
        return { allowed: false, reason: 'No subscription found.' };
      }
      const effectiveTier = subscriptionService.getEffectiveTier(subscription);
      const limits = subscriptionService.getTierLimits(effectiveTier);
      if (!limits.canExportCalendar) {
        return {
          allowed: false,
          reason: 'Calendar export is a Premium feature. Upgrade to export your shifts.',
        };
      }
      return { allowed: true };
    } catch (error) {
      console.error('[CalendarExport] Permission check failed:', error);
      return { allowed: false, reason: 'Unable to verify subscription.' };
    }
  }

  /**
   * Export shifts to an ICS file and open the native share sheet.
   */
  async exportShifts(options: ExportOptions): Promise<ExportResult> {
    try {
      // 1. Verify entitlement
      const permission = await this.canExport(options.userId);
      if (!permission.allowed) {
        return { success: false, shiftCount: 0, error: permission.reason };
      }

      // 2. Validate date range — enforce server-side cap
      const rangeDays = Math.ceil(
        (options.endDate.getTime() - options.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
        return {
          success: false,
          shiftCount: 0,
          error: `Date range too large (${rangeDays} days). Maximum is ${MAX_EXPORT_RANGE_DAYS} days.`,
        };
      }
      if (rangeDays <= 0) {
        return { success: false, shiftCount: 0, error: 'Invalid date range.' };
      }

      // 3. Fetch shifts — paginate through all pages up to the hard cap
      let shifts: Shift[] = [];
      let cursor: any = undefined;
      let hasMore = true;
      const PAGE_SIZE = 200; // Fetch in 200-shift pages to limit per-query cost

      while (hasMore && shifts.length < MAX_EXPORT_SHIFTS) {
        const filters =
          options.scope === 'household' && options.householdId
            ? { householdId: options.householdId, startDate: options.startDate, endDate: options.endDate }
            : { ownerId: options.userId, startDate: options.startDate, endDate: options.endDate };

        const result = await shiftService.getShifts(filters, {
          pageSize: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        });

        shifts = shifts.concat(result.shifts);
        cursor = result.cursor;
        hasMore = result.hasMore;
      }

      // Filter out deleted
      shifts = shifts.filter(s => !s.isDeleted);

      // Enforce hard cap after filtering
      const wasCapped = shifts.length > MAX_EXPORT_SHIFTS;
      if (wasCapped) {
        shifts = shifts.slice(0, MAX_EXPORT_SHIFTS);
      }

      if (shifts.length === 0) {
        return { success: false, shiftCount: 0, error: 'No shifts found in the selected date range.' };
      }

      // 4. Generate ICS
      const calendarName = options.calendarName || 'KinShift Schedule';
      const icsContent = shiftsToICS(shifts, calendarName);

      // 5. Write to temp file
      const fileName = `kinshift-export-${Date.now()}.ics`;
      const file = new ExpoFile(Paths.cache, fileName);
      file.write(icsContent);
      const filePath = file.uri;

      // 6. Share via native share sheet
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        return { success: false, shiftCount: shifts.length, error: 'Sharing is not available on this device.' };
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'text/calendar',
        dialogTitle: 'Export Calendar',
        UTI: 'com.apple.ical.ics', // iOS-specific UTI for .ics files
      });

      // 7. Track success
      track('calendar_exported', {
        scope: options.scope,
        shiftCount: shifts.length,
        dateRange: `${options.startDate.toISOString()}-${options.endDate.toISOString()}`,
        wasCapped,
      });

      return { success: true, shiftCount: shifts.length };
    } catch (error: any) {
      console.error('[CalendarExport] Export failed:', error);
      track('calendar_export_failed', { error: String(error) }, 'error');
      return { success: false, shiftCount: 0, error: error?.message || 'Export failed.' };
    }
  }
}

export const calendarExportService = new CalendarExportService();
