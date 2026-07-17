/**
 * Outcome ledger shared by the adapter's per-hostname fail-open tracking and
 * the service's per-endpoint health stats.
 *
 * Request outcomes arrive through async callbacks with no ordering guarantee:
 * an early-started request can fail slowly while a later-started request
 * succeeds first. Ordering by transport start time (`startedAtMs`) — never by
 * completion/processing time — makes every interleaving converge to the same
 * state: an outcome whose request started before the newest applied outcome
 * is stale and rejected, and both success and failure record their order even
 * when the entry was previously empty.
 */
export interface IIpTableOutcomeLedgerEntry {
  /** Consecutive failure count; reset to 0 by an applied success */
  consecutiveFailures: number;
  /** Transport start time (Date.now) of the newest applied outcome */
  lastOutcomeAt: number;
}

export function createOutcomeLedgerEntry(): IIpTableOutcomeLedgerEntry {
  return { consecutiveFailures: 0, lastOutcomeAt: 0 };
}

export function applyOutcome(
  entry: IIpTableOutcomeLedgerEntry,
  outcome: { ok: boolean; startedAtMs: number },
): 'applied' | 'stale' {
  if (outcome.startedAtMs < entry.lastOutcomeAt) {
    return 'stale';
  }
  entry.lastOutcomeAt = outcome.startedAtMs;
  if (outcome.ok) {
    entry.consecutiveFailures = 0;
  } else {
    entry.consecutiveFailures += 1;
  }
  return 'applied';
}
