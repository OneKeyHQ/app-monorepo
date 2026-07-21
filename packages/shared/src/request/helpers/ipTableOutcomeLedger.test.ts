import {
  IP_TABLE_OUTCOME_LEDGER_FAILURE_CAP,
  applyOutcome,
  createOutcomeLedgerEntry,
  nextIpTableRequestSequence,
} from './ipTableOutcomeLedger';

describe('ipTableOutcomeLedger', () => {
  it('regression: a newer success applied first blocks an older failure arriving late', () => {
    // Request A starts at t=1 and fails slowly; request B starts at t=5 and
    // succeeds first. B must leave a ledger mark even though the entry was
    // fresh, so A's late failure is rejected as stale.
    const entry = createOutcomeLedgerEntry();
    expect(applyOutcome(entry, { ok: true, requestSequence: 5 })).toBe(
      'applied',
    );
    expect(applyOutcome(entry, { ok: false, requestSequence: 1 })).toBe(
      'stale',
    );
    expect(entry.consecutiveFailures).toBe(0);
    expect(entry.latestSuccessSequence).toBe(5);
    expect(entry.failureSequences).toEqual(new Set());
  });

  it('old failure processed first is overridden by a newer success', () => {
    const entry = createOutcomeLedgerEntry();
    expect(applyOutcome(entry, { ok: false, requestSequence: 1 })).toBe(
      'applied',
    );
    expect(entry.consecutiveFailures).toBe(1);
    expect(applyOutcome(entry, { ok: true, requestSequence: 5 })).toBe(
      'applied',
    );
    expect(entry.consecutiveFailures).toBe(0);
  });

  it('both interleavings converge to the same final state', () => {
    const a = createOutcomeLedgerEntry();
    applyOutcome(a, { ok: true, requestSequence: 5 });
    applyOutcome(a, { ok: false, requestSequence: 1 });

    const b = createOutcomeLedgerEntry();
    applyOutcome(b, { ok: false, requestSequence: 1 });
    applyOutcome(b, { ok: true, requestSequence: 5 });

    expect(a).toEqual(b);
  });

  it('keeps only failures after a late-arriving success in request order', () => {
    // Request order is failure 1, success 2, failure 3, but completion order
    // is failure 1, failure 3, success 2. The success must still cut off the
    // first failure while preserving the third.
    const entry = createOutcomeLedgerEntry();
    applyOutcome(entry, { ok: false, requestSequence: 1 });
    applyOutcome(entry, { ok: false, requestSequence: 3 });
    expect(applyOutcome(entry, { ok: true, requestSequence: 2 })).toBe(
      'applied',
    );
    expect(entry.consecutiveFailures).toBe(1);
  });

  it('accumulates unresolved failures regardless of completion order', () => {
    const entry = createOutcomeLedgerEntry();
    applyOutcome(entry, { ok: false, requestSequence: 10 });
    applyOutcome(entry, { ok: false, requestSequence: 11 });
    // This request completed last but is still an unresolved failure: without
    // a later success in request order, it must remain in the set.
    applyOutcome(entry, { ok: false, requestSequence: 5 });
    expect(entry.consecutiveFailures).toBe(3);
    expect(entry.latestSuccessSequence).toBe(0);
    expect(entry.failureSequences).toEqual(new Set([10, 11, 5]));
  });

  it('orders requests that start in the same wall-clock millisecond', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5);
    const earlierSequence = nextIpTableRequestSequence();
    const laterSequence = nextIpTableRequestSequence();
    expect(Date.now()).toBe(5);
    expect(laterSequence).toBeGreaterThan(earlierSequence);

    const entry = createOutcomeLedgerEntry();
    applyOutcome(entry, { ok: true, requestSequence: laterSequence });
    expect(
      applyOutcome(entry, { ok: false, requestSequence: earlierSequence }),
    ).toBe('stale');
    expect(entry.consecutiveFailures).toBe(0);
  });

  it('bounds retained failures while keeping the greatest request sequences', () => {
    const entry = createOutcomeLedgerEntry();
    const highestSequence = IP_TABLE_OUTCOME_LEDGER_FAILURE_CAP + 5;
    // Insert the greatest sequence first so insertion-order eviction would
    // incorrectly discard it. Retention must be based on request order.
    const completionOrder = [
      highestSequence,
      ...Array.from({ length: highestSequence - 1 }, (_, index) => index + 1),
    ];
    completionOrder.forEach((requestSequence) => {
      applyOutcome(entry, { ok: false, requestSequence });
    });

    expect(entry.failureSequences.size).toBe(
      IP_TABLE_OUTCOME_LEDGER_FAILURE_CAP,
    );
    expect([...entry.failureSequences].toSorted((a, b) => a - b)).toEqual(
      Array.from(
        { length: IP_TABLE_OUTCOME_LEDGER_FAILURE_CAP },
        (_, index) => index + 6,
      ),
    );
    expect(entry.consecutiveFailures).toBe(IP_TABLE_OUTCOME_LEDGER_FAILURE_CAP);
  });

  it('keeps an exact below-threshold count after pruning with a late success', () => {
    const entry = createOutcomeLedgerEntry();
    const highestSequence = IP_TABLE_OUTCOME_LEDGER_FAILURE_CAP + 5;
    for (
      let requestSequence = 1;
      requestSequence <= highestSequence;
      requestSequence += 1
    ) {
      applyOutcome(entry, { ok: false, requestSequence });
    }

    applyOutcome(entry, {
      ok: true,
      requestSequence: highestSequence - 2,
    });

    expect(entry.failureSequences).toEqual(
      new Set([highestSequence - 1, highestSequence]),
    );
    expect(entry.consecutiveFailures).toBe(2);
  });
});
