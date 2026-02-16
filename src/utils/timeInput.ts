/**
 * Shared time input utilities used across AddShift, PatternBuilder, and DayDetail screens.
 * Provides smart formatting ("0455" → "04:55"), 12/24hr support, and AM/PM handling.
 */

/**
 * Smart time input formatting - handles various input patterns:
 * "0455" → "04:55", "455" → "04:55", "4:55" → "04:55", "04" → "04"
 */
export const formatTimeInput = (input: string): string => {
  // Remove all non-digits
  const digitsOnly = input.replace(/\D/g, '');

  if (digitsOnly.length === 0) return '';
  if (digitsOnly.length <= 2) {
    // Just hours: "4" or "04"
    return digitsOnly;
  }
  if (digitsOnly.length === 3) {
    // "455" → "04:55"
    return `0${digitsOnly[0]}:${digitsOnly.substring(1)}`;
  }
  if (digitsOnly.length >= 4) {
    // "0455" → "04:55"
    const hours = digitsOnly.substring(0, 2);
    const minutes = digitsOnly.substring(2, 4);
    return `${hours}:${minutes}`;
  }
  return input;
};

/**
 * Parse a time string (HH:mm or h:mm) into hours and minutes,
 * accounting for 12/24hr format and AM/PM.
 * Returns null if the input is invalid.
 */
export const parseTimeString = (
  input: string,
  is24Hour: boolean,
  ampm?: 'AM' | 'PM'
): { hours: number; minutes: number } | null => {
  const formatted = formatTimeInput(input);
  const timeParts = formatted.match(/(\d{1,2}):?(\d{0,2})/);
  if (!timeParts) return null;

  let hours = parseInt(timeParts[1], 10);
  const minutes = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

  // Handle 12hr format with AM/PM
  if (!is24Hour && ampm) {
    if (hours > 12) return null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  // Validate
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
};

/**
 * Convert a 24-hour time string "HH:mm" to a display string
 * based on the current format preference.
 */
export const formatTimeDisplay = (time24: string, is24Hour: boolean): string => {
  const match = time24.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time24;

  const h = parseInt(match[1], 10);
  const m = match[2];

  if (is24Hour) {
    return `${String(h).padStart(2, '0')}:${m}`;
  }

  // 12-hour format (without AM/PM suffix - that's shown separately)
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m}`;
};

/**
 * Get AM/PM from a 24-hour time string "HH:mm"
 */
export const getAMPM = (time24: string): 'AM' | 'PM' => {
  const match = time24.match(/^(\d{1,2}):/);
  if (!match) return 'AM';
  return parseInt(match[1], 10) >= 12 ? 'PM' : 'AM';
};

/**
 * Convert parsed hours + minutes back to "HH:mm" 24-hour string
 */
export const to24HourString = (hours: number, minutes: number): string => {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
