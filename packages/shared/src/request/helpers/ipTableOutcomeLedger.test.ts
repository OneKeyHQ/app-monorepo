import {
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
    expect(entry.lastOutcomeSequence).toBe(5);
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

  it('consecutive failures accumulate only for non-stale outcomes', () => {
    const entry = createOutcomeLedgerEntry();
    applyOutcome(entry, { ok: false, requestSequence: 10 });
    applyOutcome(entry, { ok: false, requestSequence: 11 });
    // stale failure from before the first one
    applyOutcome(entry, { ok: false, requestSequence: 5 });
    expect(entry.consecutiveFailures).toBe(2);
    expect(entry.lastOutcomeSequence).toBe(11);
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
});
