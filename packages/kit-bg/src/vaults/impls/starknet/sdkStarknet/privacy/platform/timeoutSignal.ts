// onekey: upstream called `AbortSignal.timeout(ms)` directly
// (internal/proving-service.ts, internal/indexer-discovery.ts). Hermes and
// older WebViews do not ship it, so fall back to a timer-backed controller.
import { StarknetPrivacySdkPlatformError } from './errors';

export type ITimeoutSignalHandle = {
  signal: AbortSignal;
  cancel: () => void;
};

/**
 * Create a cancellable `AbortSignal` handle that aborts after `ms` milliseconds.
 * Call `cancel()` in a `finally` block once the request settles so Hermes and
 * other runtimes without `AbortSignal.timeout` do not leak live timers.
 */
export function createTimeoutSignal(ms: number): ITimeoutSignalHandle {
  if (
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function'
  ) {
    return { signal: AbortSignal.timeout(ms), cancel: () => undefined };
  }
  if (typeof AbortController === 'undefined') {
    throw new StarknetPrivacySdkPlatformError(
      'no AbortController in this runtime; request timeouts are unavailable',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const error = new StarknetPrivacySdkPlatformError(
      `request timed out after ${ms}ms`,
    );
    error.name = 'TimeoutError';
    controller.abort(error);
  }, ms);
  // Node keeps the process alive for pending timers; browser/Hermes no-op.
  (timer as unknown as { unref?: () => void })?.unref?.();
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/**
 * Run an async operation with a timeout-backed `AbortSignal`, always clearing
 * any fallback timer once the operation settles.
 */
export async function withTimeoutSignal<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const { signal, cancel } = createTimeoutSignal(ms);
  try {
    return await fn(signal);
  } finally {
    cancel();
  }
}

/**
 * An `AbortSignal` that aborts after `ms` milliseconds.
 *
 * Uses `AbortSignal.timeout` when the runtime provides it, otherwise a
 * `setTimeout`-backed `AbortController`.
 */
export function timeoutSignal(ms: number): AbortSignal {
  return createTimeoutSignal(ms).signal;
}
