// Client-side rate limiting utilities

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private static storage = new Map<string, RateLimitEntry>();
  private static readonly DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly DEFAULT_MAX_ATTEMPTS = 5;

  /**
   * Check if an operation is rate limited
   */
  static isRateLimited(
    key: string, 
    maxAttempts: number = this.DEFAULT_MAX_ATTEMPTS,
    windowMs: number = this.DEFAULT_WINDOW_MS
  ): boolean {
    const now = Date.now();
    const entry = this.storage.get(key);

    // No previous attempts
    if (!entry) {
      this.storage.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return false;
    }

    // Check if blocked period has expired
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return true;
    }

    // Check if window has expired
    if (now - entry.firstAttempt > windowMs) {
      this.storage.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now
      });
      return false;
    }

    // Increment attempt count
    entry.count++;
    entry.lastAttempt = now;

    // Check if limit exceeded
    if (entry.count > maxAttempts) {
      entry.blockedUntil = now + windowMs;
      this.storage.set(key, entry);
      return true;
    }

    this.storage.set(key, entry);
    return false;
  }

  /**
   * Get remaining attempts for a key
   */
  static getRemainingAttempts(
    key: string,
    maxAttempts: number = this.DEFAULT_MAX_ATTEMPTS
  ): number {
    const entry = this.storage.get(key);
    if (!entry) return maxAttempts;
    
    return Math.max(0, maxAttempts - entry.count);
  }

  /**
   * Get time until rate limit resets (in milliseconds)
   */
  static getResetTime(key: string, windowMs: number = this.DEFAULT_WINDOW_MS): number {
    const entry = this.storage.get(key);
    if (!entry) return 0;

    const now = Date.now();
    
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return entry.blockedUntil - now;
    }

    const windowEnd = entry.firstAttempt + windowMs;
    return Math.max(0, windowEnd - now);
  }

  /**
   * Reset rate limit for a key
   */
  static reset(key: string): void {
    this.storage.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  static clearAll(): void {
    this.storage.clear();
  }

  /**
   * Cleanup expired entries
   */
  static cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.storage.entries()) {
      // Remove entries that are no longer blocked and outside their window
      if (!entry.blockedUntil || now >= entry.blockedUntil) {
        if (now - entry.firstAttempt > this.DEFAULT_WINDOW_MS) {
          this.storage.delete(key);
        }
      }
    }
  }
}

// Rate limiting decorator for functions
export function withRateLimit<T extends (...args: any[]) => any>(
  fn: T,
  key: string,
  maxAttempts?: number,
  windowMs?: number
): T {
  return ((...args: any[]) => {
    if (RateLimiter.isRateLimited(key, maxAttempts, windowMs)) {
      const resetTime = RateLimiter.getResetTime(key, windowMs);
      const resetMinutes = Math.ceil(resetTime / (60 * 1000));
      throw new Error(`Rate limit exceeded. Try again in ${resetMinutes} minute(s).`);
    }
    
    return fn(...args);
  }) as T;
}

// Auto-cleanup every 5 minutes
setInterval(() => {
  RateLimiter.cleanup();
}, 5 * 60 * 1000);