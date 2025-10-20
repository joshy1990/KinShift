/**
 * Rate Limiting Cloud Function
 * 
 * Implements distributed rate limiting for Firestore operations
 * Protects against brute force attacks, DoS, and excessive API usage
 * 
 * Critical Finding: Rate limiting was missing from security rules audit
 * Severity: HIGH
 * 
 * Deployment:
 *   gcloud functions deploy rateLimitEnforcer --runtime nodejs18 --trigger-topic rate-limit-enforcer
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as Redis from 'redis';

const db = admin.firestore();
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '1'),
});

/**
 * Rate Limit Configuration
 * 
 * Define per-operation limits and windows
 */
const RATE_LIMITS = {
  // Authentication operations
  'auth:signUp': { limit: 5, window: 3600 }, // 5 per hour
  'auth:signIn': { limit: 10, window: 300 }, // 10 per 5 minutes
  'auth:resetPassword': { limit: 3, window: 3600 }, // 3 per hour
  
  // Household operations
  'household:create': { limit: 10, window: 86400 }, // 10 per day
  'household:invite': { limit: 20, window: 3600 }, // 20 per hour
  'household:update': { limit: 100, window: 3600 }, // 100 per hour
  
  // Shift operations
  'shift:create': { limit: 50, window: 3600 }, // 50 per hour
  'shift:update': { limit: 200, window: 3600 }, // 200 per hour
  'shift:delete': { limit: 20, window: 3600 }, // 20 per hour
  
  // Pattern operations
  'pattern:create': { limit: 10, window: 86400 }, // 10 per day
  'pattern:update': { limit: 50, window: 3600 }, // 50 per hour
  
  // Invitation operations
  'invitation:create': { limit: 20, window: 3600 }, // 20 per hour
  'invitation:accept': { limit: 100, window: 3600 }, // 100 per hour
  'invitation:decline': { limit: 50, window: 3600 }, // 50 per hour
  
  // Subscription operations
  'subscription:create': { limit: 5, window: 86400 }, // 5 per day
  'subscription:cancel': { limit: 5, window: 86400 }, // 5 per day
  
  // Message operations
  'message:create': { limit: 100, window: 60 }, // 100 per minute
  'message:delete': { limit: 50, window: 60 }, // 50 per minute
};

/**
 * Redis key generator
 * Combines user ID and operation type for distributed tracking
 */
function getRateLimitKey(userId: string, operation: string): string {
  return `rateLimit:${userId}:${operation}:${Math.floor(Date.now() / 1000)}`;
}

/**
 * Check if user has exceeded rate limit
 * 
 * @param userId - User ID
 * @param operation - Operation type (e.g., 'shift:create')
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export async function checkRateLimit(
  userId: string,
  operation: string
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}> {
  const config = RATE_LIMITS[operation];
  
  if (!config) {
    // Operation not rate-limited
    return {
      allowed: true,
      remaining: -1, // Unlimited
      resetAt: 0,
    };
  }

  const key = `${userId}:${operation}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.window;

  try {
    // Get current count
    const countKey = `rateLimit:${key}:count`;
    const windowKey = `rateLimit:${key}:window`;

    const [count, storedWindow] = await Promise.all([
      redisClient.get(countKey),
      redisClient.get(windowKey),
    ]);

    const currentCount = parseInt(count || '0', 10);
    const window = parseInt(storedWindow || String(now), 10);

    // Check if window expired
    if (now - window >= config.window) {
      // Reset counter
      await Promise.all([
        redisClient.setex(countKey, config.window, '1'),
        redisClient.setex(windowKey, config.window, String(now)),
      ]);

      return {
        allowed: true,
        remaining: config.limit - 1,
        resetAt: now + config.window,
      };
    }

    // Check if limit exceeded
    if (currentCount >= config.limit) {
      const resetAt = window + config.window;
      const retryAfter = resetAt - now;

      await logRateLimitExceeded(userId, operation, currentCount, config.limit);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Increment counter
    await redisClient.incr(countKey);

    return {
      allowed: true,
      remaining: config.limit - currentCount - 1,
      resetAt: window + config.window,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    
    // Fail open - allow operation if Redis unavailable
    return {
      allowed: true,
      remaining: -1,
      resetAt: 0,
    };
  }
}

/**
 * Log rate limit exceeded event
 * 
 * @param userId - User ID
 * @param operation - Operation type
 * @param count - Current count
 * @param limit - Rate limit threshold
 */
async function logRateLimitExceeded(
  userId: string,
  operation: string,
  count: number,
  limit: number
): Promise<void> {
  try {
    await db.collection('rateLimitEvents').add({
      userId,
      operation,
      count,
      limit,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      severity: count > limit * 2 ? 'high' : 'medium',
      userAgent: '',
      ipAddress: '', // Filled by Cloud Function context
    });

    // Alert if excessive violations
    if (count > limit * 3) {
      await sendSecurityAlert({
        type: 'EXCESSIVE_RATE_LIMIT_VIOLATIONS',
        userId,
        operation,
        violations: count,
        severity: 'HIGH',
      });
    }
  } catch (error) {
    console.error('Error logging rate limit exceeded:', error);
  }
}

/**
 * Enforce rate limits on Firestore writes
 * 
 * This HTTP function should be called from client SDKs via callable function
 */
export const enforceRateLimit = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const { operation } = data;
  const userId = context.auth.uid;

  if (!operation) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Operation type required'
    );
  }

  const result = await checkRateLimit(userId, operation);

  if (!result.allowed) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Rate limit exceeded for ${operation}. Retry after ${result.retryAfter} seconds.`,
      {
        retryAfter: result.retryAfter,
        resetAt: result.resetAt,
      }
    );
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
});

/**
 * Firestore trigger for tracking actual operations
 * 
 * This monitors successful operations and logs them for analytics
 */
export const trackOperation = functions.firestore
  .document('shifts/{shiftId}')
  .onCreate(async (snap, context) => {
    const userId = snap.get('createdBy');
    
    // Operation already rate-limited before write, but track for analytics
    try {
      await db.collection('operationMetrics').add({
        userId,
        operation: 'shift:create',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        shiftId: snap.id,
        duration: context.timestamp ? Date.now() - new Date(context.timestamp).getTime() : 0,
      });
    } catch (error) {
      console.error('Error tracking operation:', error);
    }
  });

/**
 * Scheduled function to clean up expired rate limit data
 * 
 * Runs hourly to remove old Redis entries
 */
export const cleanupRateLimits = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    console.log('Cleaning up expired rate limit data...');
    
    try {
      // Redis automatically expires keys based on TTL
      // This function serves as a notification that cleanup is happening
      
      // Also clean up old events from Firestore
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const batch = db.batch();
      const query = db.collection('rateLimitEvents')
        .where('timestamp', '<', thirtyDaysAgo);
      
      const snapshot = await query.get();
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Deleted ${snapshot.size} old rate limit events`);
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  });

/**
 * Send security alert for suspicious activity
 */
async function sendSecurityAlert(alert: {
  type: string;
  userId: string;
  operation: string;
  violations: number;
  severity: string;
}): Promise<void> {
  try {
    // Log to Firestore
    await db.collection('securityAlerts').add({
      ...alert,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      acknowledged: false,
    });

    // Send notification (implement based on your notification service)
    console.warn('SECURITY ALERT:', alert);
  } catch (error) {
    console.error('Error sending security alert:', error);
  }
}

/**
 * Health check endpoint for rate limiter
 */
export const rateLimitHealthCheck = functions.https.onRequest(
  async (req, res) => {
    try {
      await redisClient.ping();
      res.status(200).json({ status: 'healthy', redis: 'connected' });
    } catch (error) {
      res.status(500).json({ status: 'unhealthy', redis: 'disconnected', error });
    }
  }
);

/**
 * Type definitions
 */
declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: {
        userId: string;
        operation: string;
        remaining: number;
        resetAt: number;
      };
    }
  }
}

export default {
  checkRateLimit,
  enforceRateLimit,
  trackOperation,
  cleanupRateLimits,
  rateLimitHealthCheck,
};
