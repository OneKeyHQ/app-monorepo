// Rapid account switching puts several saves in flight at once, so stale drops
// arrive in bursts. Log the first of a burst and count the rest into the next
// entry: the diagnostic value is in knowing a drop happened and roughly how
// often, not in one line per occurrence.
//
// This deliberately does not rely on the log transport's identical-message
// collapsing — that only folds *consecutive* messages, and in a running app
// other logs are interleaved constantly.
export const STALE_DROP_LOG_THROTTLE_MS = 5000;

const throttleState = new Map<
  string,
  { lastLoggedAt: number; suppressed: number }
>();

/**
 * Returns the number of drops suppressed since the previous entry when this call
 * should be logged, or `undefined` when it falls inside the throttle window.
 */
export function takeStaleDropLogSlot(key: string): number | undefined {
  const now = Date.now();
  const state = throttleState.get(key);
  if (!state || now - state.lastLoggedAt >= STALE_DROP_LOG_THROTTLE_MS) {
    const suppressed = state?.suppressed || 0;
    throttleState.set(key, { lastLoggedAt: now, suppressed: 0 });
    return suppressed;
  }
  state.suppressed += 1;
  return undefined;
}

export function resetStaleDropLogThrottleForTest() {
  throttleState.clear();
}
