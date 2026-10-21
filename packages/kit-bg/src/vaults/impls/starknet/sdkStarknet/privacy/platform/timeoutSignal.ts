// onekey: upstream called `AbortSignal.timeout(ms)` directly
// (internal/proving-service.ts, internal/indexer-discovery.ts). Hermes and
// older WebViews do not ship it, so fall back to a timer-backed controller.
import { StarknetPrivacySdkPlatformError } from './errors';

/**
 * An `AbortSignal` that aborts after `ms` milliseconds.
 *
 * Uses `AbortSignal.timeout` when the runtime provides it, otherwise a
 * `setTimeout`-backed `AbortController`.
 */
export function timeoutSignal(ms: number): AbortSignal {
  if (
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function'
  ) {
    return AbortSignal.timeout(ms);
  }
  if (typeof AbortController === 'undefined') {
    throw new StarknetPrivacySdkPlatformError(
      'no AbortController in this runtime; request timeouts are unavailable',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(
      new StarknetPrivacySdkPlatformError(`request timed out after ${ms}ms`),
    );
  }, ms);
  // Node keeps the process alive for pending timers; browser/Hermes no-op.
  (timer as unknown as { unref?: () => void })?.unref?.();
  return controller.signal;
}
