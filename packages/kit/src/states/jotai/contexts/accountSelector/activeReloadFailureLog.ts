// The active-account reload runs behind a 150ms throttle per selector instance
// and is re-triggered by AccountUpdate / WalletUpdate events, which fire once
// per account during a batch import or wallet sync. When the background runtime
// is unreachable — an extension service worker the browser recycled, a cold
// start before bg is ready — every one of those attempts fails the same way, so
// logging each failure would bury the exported log in hundreds of identical
// lines at exactly the moment a support report needs it.
//
// Only transitions are recorded: the first failure of a run, a run whose cause
// changed, and the recovery that ends it. The suppressed attempts are not lost —
// they come back as `failuresBeforeRecovery` on the recovery entry, which is
// what separates a one-off from a background runtime that stayed down.
//
// A run that never recovers therefore leaves a single failure entry and no
// recovery entry. That absence is the signal: recovery is logged unconditionally
// on the next success, so a missing recovery entry means the reload never
// succeeded again, without paying one line per retry to say so.
//
// This is deliberately edge-triggered rather than time-throttled like
// takeStaleDropLogSlot: a stale drop is a burst inside normal operation and
// sampling it over time is the right answer, while these failures are a
// sustained state where every extra line repeats what the first one said.

type IActiveReloadFailureState = {
  consecutiveFailures: number;
  errorName: string | undefined;
};

// Keyed by scene + num + phase, all drawn from fixed sets, and entries are
// deleted on recovery — the map cannot grow without bound.
const failureState = new Map<string, IActiveReloadFailureState>();

export function buildActiveReloadFailureKey({
  num,
  phase,
  sceneName,
}: {
  num: number;
  phase: string;
  sceneName: string | undefined;
}) {
  return `${sceneName || 'unknown'}/${num}/${phase}`;
}

/**
 * Returns the payload fields for a failure that should be logged, or `undefined`
 * when this failure repeats one already reported for the same key and cause.
 *
 * `previousFailures` is set only when the cause changed while the run was still
 * failing, so the count accumulated under the previous cause is carried into the
 * entry that supersedes it instead of being dropped.
 */
export function takeActiveReloadFailureLogSlot({
  errorName,
  key,
}: {
  errorName: string | undefined;
  key: string;
}):
  | {
      consecutiveFailures: number;
      previousFailures: number | undefined;
    }
  | undefined {
  const state = failureState.get(key);
  if (state && state.errorName === errorName) {
    state.consecutiveFailures += 1;
    return undefined;
  }
  failureState.set(key, { consecutiveFailures: 1, errorName });
  return {
    consecutiveFailures: 1,
    previousFailures: state?.consecutiveFailures,
  };
}

/**
 * Returns how many failures preceded this success, or `undefined` when the key
 * was not in a failing run — the normal path, and the only cost it pays is one
 * map lookup.
 */
export function takeActiveReloadRecoveryLogSlot(
  key: string,
): number | undefined {
  const state = failureState.get(key);
  if (!state) {
    return undefined;
  }
  failureState.delete(key);
  return state.consecutiveFailures;
}

export function resetActiveReloadFailureLogForTest() {
  failureState.clear();
}
