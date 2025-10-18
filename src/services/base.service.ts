/**
 * Base service class with common patterns for Firebase operations
 */

export interface ServiceError {
  code: string;
  message: string;
  details?: any;
}

export class BaseService {
  /**
   * Handles Firebase errors and converts them to consistent ServiceError format
   */
  protected handleError(error: any): ServiceError {
    console.error('Service error:', error);

    // Firebase auth errors
    if (error.code?.startsWith('auth/')) {
      return this.handleAuthError(error);
    }

    // Firebase Firestore errors
    if (error.code?.startsWith('firestore/')) {
      return this.handleFirestoreError(error);
    }

    // Network errors - check for network-related error messages
    if (error.message?.toLowerCase().includes('network') || 
        error.code === 'network-request-failed') {
      return {
        code: 'network/offline',
        message: 'Network error. Please check your connection and try again.',
      };
    }

    // Generic error
    return {
      code: 'unknown/error',
      message: error.message || 'An unexpected error occurred',
      details: error,
    };
  }

  private handleAuthError(error: any): ServiceError {
    const errorMap: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email address',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection',
    };

    return {
      code: error.code,
      message: errorMap[error.code] || 'Authentication error occurred',
    };
  }

  private handleFirestoreError(error: any): ServiceError {
    const errorMap: Record<string, string> = {
      'firestore/permission-denied': 'You do not have permission to perform this action',
      'firestore/not-found': 'The requested data was not found',
      'firestore/already-exists': 'This item already exists',
      'firestore/resource-exhausted': 'Too many requests. Please try again later',
      'firestore/cancelled': 'Operation was cancelled',
      'firestore/data-loss': 'Data may have been lost or corrupted',
    };

    return {
      code: error.code,
      message: errorMap[error.code] || 'Database error occurred',
    };
  }

  /**
   * Retry mechanism for failed operations
   */
  protected async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        await this.sleep(delay * Math.pow(2, attempt - 1));
      }
    }

    throw lastError;
  }

  private shouldNotRetry(error: any): boolean {
    const noRetryErrors = [
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-email',
      'firestore/permission-denied',
      'firestore/not-found',
    ];

    return noRetryErrors.includes(error.code);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates required fields
   */
  protected validateRequired(data: Record<string, any>, fields: string[]): void {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Sanitizes user input to prevent XSS
   */
  protected sanitizeString(input: string): string {
    return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
}