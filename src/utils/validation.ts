/**
 * Input Validation Utility
 * Provides comprehensive input validation for security-critical data
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validators = {
  /**
   * Validate email address (RFC 5322 simplified)
   */
  email: (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    if (email.length > 254) return false;
    // Stricter regex: local part allows letters, digits, and ._%+-
    // Domain requires at least one dot and 2+ char TLD
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  },

  /**
   * Validate household name
   */
  householdName: (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  },

  /**
   * Validate shift title
   */
  shiftTitle: (title: string): boolean => {
    if (!title || typeof title !== 'string') return false;
    const trimmed = title.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  },

  /**
   * Validate shift notes
   */
  shiftNotes: (notes: string): boolean => {
    if (!notes || typeof notes !== 'string') return true; // Optional
    return notes.length <= 500;
  },

  /**
   * Validate person name
   */
  personName: (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 1 && trimmed.length <= 100;
  },

  /**
   * Validate phone number (basic)
   */
  phoneNumber: (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    // Remove common formatting characters
    const cleaned = phone.replace(/[\s\-(). ]/g, '');
    // Should be at least 7 and at most 15 digits
    return /^\d{7,15}$/.test(cleaned);
  },

  /**
   * Validate user ID (Firebase format)
   */
  userId: (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    // Firebase UIDs are typically 28 characters
    return id.length >= 6 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
  },

  /**
   * Validate household ID
   */
  householdId: (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    return id.length >= 6 && id.length <= 128;
  },

  /**
   * Validate shift ID
   */
  shiftId: (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    return id.length >= 6 && id.length <= 128;
  },

  /**
   * Validate date is not in past
   */
  futureDate: (date: Date): boolean => {
    if (!(date instanceof Date)) return false;
    return date > new Date();
  },

  /**
   * Validate date range (start < end)
   */
  dateRange: (startTime: Date, endTime: Date): boolean => {
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) return false;
    return startTime < endTime;
  },

  /**
   * Validate shift duration (not more than 24 hours)
   */
  shiftDuration: (startTime: Date, endTime: Date, maxHours: number = 24): boolean => {
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) return false;
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours > 0 && durationHours <= maxHours;
  },

  /**
   * Validate subscription tier
   */
  subscriptionTier: (tier: string): boolean => {
    const validTiers = ['free', 'standard', 'premium'];
    return validTiers.includes(tier);
  },

  /**
   * Validate role
   */
  role: (role: string): boolean => {
    const validRoles = ['member', 'admin'];
    return validRoles.includes(role);
  },

  /**
   * Validate shift type
   */
  shiftType: (type: string): boolean => {
    const validTypes = ['days', 'nights', 'afternoons', 'morning', 'evening', 'custom'];
    return validTypes.includes(type);
  },

  /**
   * Validate against XSS attacks (basic)
   */
  noXSS: (input: string): boolean => {
    if (!input || typeof input !== 'string') return true;
    // Check for common XSS patterns
    const xssPatterns = /<script|<iframe|<img|onerror|onload|eval|javascript:/gi;
    return !xssPatterns.test(input);
  },
};

/**
 * Sanitize input by removing potentially harmful characters
 */
export const sanitize = {
  /**
   * Sanitize text input (trim, limit length, remove XSS)
   */
  text: (input: string, maxLength: number = 1000): string => {
    if (!input || typeof input !== 'string') return '';
    let sanitized = input.trim();
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    // Limit length
    sanitized = sanitized.substring(0, maxLength);
    return sanitized;
  },

  /**
   * Sanitize email
   */
  email: (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    return input.toLowerCase().trim().substring(0, 254);
  },

  /**
   * Sanitize name
   */
  name: (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    let sanitized = input.trim();
    // Remove extra whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    return sanitized.substring(0, 100);
  },

  /**
   * Sanitize phone number
   */
  phone: (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    // Remove all non-digit characters except + at start
    let sanitized = input.replace(/[^\d+]/g, '');
    // Ensure + only at the start
    if (sanitized.includes('+')) {
      sanitized = '+' + sanitized.replace(/\+/g, '');
    }
    return sanitized.substring(0, 20);
  },
};

/**
 * Validation context - combines validation with error handling
 */
export class ValidationValidator {
  private errors: Map<string, string> = new Map();

  /**
   * Add a validation error
   */
  addError(field: string, message: string): void {
    this.errors.set(field, message);
  }

  /**
   * Check if there are any errors
   */
  hasErrors(): boolean {
    return this.errors.size > 0;
  }

  /**
   * Get all errors
   */
  getErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    this.errors.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Get errors as formatted string
   */
  getErrorString(): string {
    const errors: string[] = [];
    this.errors.forEach((value, key) => {
      errors.push(`${key}: ${value}`);
    });
    return errors.join('; ');
  }

  /**
   * Throw if there are errors
   */
  throwIfErrors(): void {
    if (this.hasErrors()) {
      throw new ValidationError(this.getErrorString());
    }
  }

  /**
   * Validate email
   */
  validateEmail(email: string, fieldName: string = 'email'): void {
    if (!validators.email(email)) {
      this.addError(fieldName, 'Invalid email address');
    }
  }

  /**
   * Validate required string
   */
  validateRequired(value: string, fieldName: string): void {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      this.addError(fieldName, 'This field is required');
    }
  }

  /**
   * Validate string length
   */
  validateLength(value: string, min: number, max: number, fieldName: string): void {
    if (!value) return; // Handle in validateRequired
    const length = value.trim().length;
    if (length < min || length > max) {
      this.addError(fieldName, `Must be between ${min} and ${max} characters`);
    }
  }

  /**
   * Validate date range
   */
  validateDateRange(startDate: Date, endDate: Date): void {
    if (!validators.dateRange(startDate, endDate)) {
      this.addError('dates', 'End time must be after start time');
    }
  }
}
