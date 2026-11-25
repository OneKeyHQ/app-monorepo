/**
 * Concurrency limiter and retry utilities for async operations.
 * No external dependencies - browser/mobile compatible.
 */

export type RateLimitOptions = {
  /** Maximum concurrent operations (default: 8) */
  concurrency?: number;
  /** Maximum retry attempts for failed operations (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 100) */
  baseDelayMs?: number;
};

/**
 * Creates a concurrency limiter that restricts how many async operations
 * can run simultaneously.
 *
 * @param concurrency Maximum number of concurrent operations
 * @returns A function that wraps async operations with concurrency control
 *
 * @example
 * const limit = createLimiter(2);
 * // Only 2 of these will run at a time:
 * await Promise.all([
 *   limit(() => fetch('/a')),
 *   limit(() => fetch('/b')),
 *   limit(() => fetch('/c')),
 * ]);
 */
export function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    // Wait if at capacity
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      // Wake up next queued task
      queue.shift()?.();
    }
  };

  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps an object (typically a contract interface) with rate limiting and retry logic.
 * All method calls on the returned proxy will be:
 * 1. Limited to `concurrency` simultaneous executions
 * 2. Retried with exponential backoff on failure
 *
 * @param obj The object to wrap
 * @param options Rate limiting and retry configuration
 * @returns A proxy with the same interface, but with rate limiting applied
 *
 * @example
 * const limitedPool = createRateLimitedPool(poolContract, { concurrency: 4 });
 * // Now all calls to limitedPool methods are rate-limited
 */
export function createRateLimitedObject<T extends object>(
  obj: T,
  options: RateLimitOptions = {}
): T {
  const { concurrency = 8, maxRetries = 3, baseDelayMs = 100 } = options;
  const limit = createLimiter(concurrency);

  const withRetry = async <R>(fn: () => Promise<R>): Promise<R> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
    }
    throw new Error("Unreachable");
  };

  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => limit(() => withRetry(() => value.apply(target, args)));
      }
      return value;
    },
  }) as T;
}
