import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/config/firebase.config';

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  registration: { maxAttempts: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  passwordReset: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 per hour
  joinHousehold: { maxAttempts: 10, windowMs: 60 * 60 * 1000 }, // 10 per hour
  createInvitation: { maxAttempts: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  createShift: { maxAttempts: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
};

/**
 * Rate Limiting Service - Prevents abuse of sensitive operations
 * Uses local in-memory storage for performance (can be extended to use Cloud Functions)
 */
class RateLimitService {
  private attempts: Map<string, Array<number>> = new Map();

  /**
   * Check if action is rate-limited
   * @param key Unique identifier (userId, email, IP, etc)
   * @param actionType Type of action to rate limit
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  checkRateLimit(
    key: string,
    actionType: keyof typeof DEFAULT_CONFIGS,
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const config = DEFAULT_CONFIGS[actionType];
    if (!config) {
      return { allowed: true, remaining: -1, resetTime: 0 };
    }

    const now = Date.now();
    const attemptKey = `${key}:${actionType}`;
    let attempts = this.attempts.get(attemptKey) || [];

    // Remove old attempts outside the window
    attempts = attempts.filter(timestamp => now - timestamp < config.windowMs);

    if (attempts.length >= config.maxAttempts) {
      const oldestAttempt = attempts[0];
      const resetTime = oldestAttempt + config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    // Record this attempt
    attempts.push(now);
    this.attempts.set(attemptKey, attempts);

    return {
      allowed: true,
      remaining: config.maxAttempts - attempts.length,
      resetTime: 0,
    };
  }

  /**
   * Reset rate limit for a key (for testing or admin purposes)
   */
  resetRateLimit(key: string, actionType?: keyof typeof DEFAULT_CONFIGS): void {
    if (actionType) {
      const attemptKey = `${key}:${actionType}`;
      this.attempts.delete(attemptKey);
    } else {
      // Remove all attempts for this key
      const keysToDelete: string[] = [];
      this.attempts.forEach((_, attemptKey) => {
        if (attemptKey.startsWith(key)) {
          keysToDelete.push(attemptKey);
        }
      });
      keysToDelete.forEach(k => this.attempts.delete(k));
    }
  }

  /**
   * Get rate limit info for a key
   */
  getRateLimitInfo(
    key: string,
    actionType: keyof typeof DEFAULT_CONFIGS,
  ): { attempts: number; limit: number; resetTime: number } {
    const config = DEFAULT_CONFIGS[actionType];
    if (!config) {
      return { attempts: 0, limit: 0, resetTime: 0 };
    }

    const now = Date.now();
    const attemptKey = `${key}:${actionType}`;
    let attempts = this.attempts.get(attemptKey) || [];

    // Remove old attempts
    attempts = attempts.filter(timestamp => now - timestamp < config.windowMs);

    const resetTime = attempts.length > 0 ? attempts[0] + config.windowMs : 0;

    return {
      attempts: attempts.length,
      limit: config.maxAttempts,
      resetTime,
    };
  }

  /**
   * Log rate limit violation
   */
  async logRateLimitViolation(
    key: string,
    actionType: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'rateLimitViolations'), {
        key,
        actionType,
        ipAddress,
        timestamp: new Date(),
      });

      console.warn(
        `⚠️ Rate limit violation: ${actionType} from ${key} (IP: ${ipAddress || 'unknown'})`,
      );
    } catch (error) {
      console.error('Failed to log rate limit violation:', error);
    }
  }
}

export const rateLimitService = new RateLimitService();
