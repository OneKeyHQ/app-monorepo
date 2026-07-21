/**
 * Outcome ledger shared by the adapter's per-hostname fail-open tracking and
 * the service's per-endpoint health stats.
 *
 * Request outcomes arrive through async callbacks with no ordering guarantee:
 * an early-started request can fail slowly while a later-started request
 * succeeds first. `Date.now()` is not a sufficient ordering key because two
 * transports can start in the same millisecond. Every runtime therefore
 * assigns a strictly increasing request sequence at transport hand-off;
 * ordering by that sequence — never by completion/processing time — lets a
 * success remove every failure at or before its request position while
 * retaining failures from later requests, regardless of arrival order.
 */
export interface IIpTableOutcomeLedgerEntry {
  /** Number of unresolved failures after the latest success */
  consecutiveFailures: number;
  /** Runtime-local request sequence of the latest successful request */
  latestSuccessSequence: number;
  /** Failure request sequences newer than latestSuccessSequence */
  failureSequences: Set<number>;
}

export function createOutcomeLedgerEntry(): IIpTableOutcomeLedgerEntry {
  return {
    consecutiveFailures: 0,
    latestSuccessSequence: 0,
    failureSequences: new Set(),
  };
}

let ipTableRequestSequence = 0;

/** Allocate at transport hand-off, before awaiting any network work. */
export function nextIpTableRequestSequence(): number {
  ipTableRequestSequence += 1;
  return ipTableRequestSequence;
}

export function applyOutcome(
  entry: IIpTableOutcomeLedgerEntry,
  outcome: { ok: boolean; requestSequence: number },
): 'applied' | 'stale' {
  if (outcome.ok) {
    if (outcome.requestSequence <= entry.latestSuccessSequence) {
      return 'stale';
    }
    entry.latestSuccessSequence = outcome.requestSequence;
    entry.failureSequences.forEach((failureSequence) => {
      if (failureSequence <= outcome.requestSequence) {
        entry.failureSequences.delete(failureSequence);
      }
    });
    entry.consecutiveFailures = entry.failureSequences.size;
    return 'applied';
  }

  if (
    outcome.requestSequence <= entry.latestSuccessSequence ||
    entry.failureSequences.has(outcome.requestSequence)
  ) {
    return 'stale';
  }
  entry.failureSequences.add(outcome.requestSequence);
  entry.consecutiveFailures = entry.failureSequences.size;
  return 'applied';
}
