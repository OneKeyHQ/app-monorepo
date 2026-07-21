/**
 * Outcome ledger shared by the adapter's per-hostname fail-open tracking and
 * the service's per-endpoint health stats.
 *
 * Request outcomes arrive through async callbacks with no ordering guarantee:
 * an early-started request can fail slowly while a later-started request
 * succeeds first. `Date.now()` is not a sufficient ordering key because two
 * transports can start in the same millisecond. Every runtime therefore
 * assigns a strictly increasing request sequence at transport hand-off;
 * ordering by that sequence — never by completion/processing time — makes
 * every interleaving converge to the same state.
 */
export interface IIpTableOutcomeLedgerEntry {
  /** Consecutive failure count; reset to 0 by an applied success */
  consecutiveFailures: number;
  /** Runtime-local request sequence of the newest applied outcome */
  lastOutcomeSequence: number;
}

export function createOutcomeLedgerEntry(): IIpTableOutcomeLedgerEntry {
  return { consecutiveFailures: 0, lastOutcomeSequence: 0 };
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
  if (outcome.requestSequence < entry.lastOutcomeSequence) {
    return 'stale';
  }
  entry.lastOutcomeSequence = outcome.requestSequence;
  if (outcome.ok) {
    entry.consecutiveFailures = 0;
  } else {
    entry.consecutiveFailures += 1;
  }
  return 'applied';
}
