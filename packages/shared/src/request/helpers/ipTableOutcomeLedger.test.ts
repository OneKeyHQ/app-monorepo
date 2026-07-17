import { applyOutcome, createOutcomeLedgerEntry } from './ipTableOutcomeLedger';

describe('ipTableOutcomeLedger', () => {
  it('regression: a newer success applied first blocks an older failure arriving late', () => {
    // Request A starts at t=1 and fails slowly; request B starts at t=5 and
    // succeeds first. B must leave a ledger mark even though the entry was
    // fresh, so A's late failure is rejected as stale.
    const entry = createOutcomeLedgerEntry();
    expect(applyOutcome(entry, { ok: true, startedAtMs: 5 })).toBe('applied');
    expect(applyOutcome(entry, { ok: false, startedAtMs: 1 })).toBe('stale');
    expect(entry.consecutiveFailures).toBe(0);
    expect(entry.lastOutcomeAt).toBe(5);
  });

  it('old failure processed first is overridden by a newer success', () => {
    const entry = createOutcomeLedgerEntry();
    expect(applyOutcome(entry, { ok: false, startedAtMs: 1 })).toBe('applied');
    expect(entry.consecutiveFailures).toBe(1);
    expect(applyOutcome(entry, { ok: true, startedAtMs: 5 })).toBe('applied');
    expect(entry.consecutiveFailures).toBe(0);
  });

  it('both interleavings converge to the same final state', () => {
    const a = createOutcomeLedgerEntry();
    applyOutcome(a, { ok: true, startedAtMs: 5 });
    applyOutcome(a, { ok: false, startedAtMs: 1 });

    const b = createOutcomeLedgerEntry();
    applyOutcome(b, { ok: false, startedAtMs: 1 });
    applyOutcome(b, { ok: true, startedAtMs: 5 });

    expect(a).toEqual(b);
  });

  it('consecutive failures accumulate only for non-stale outcomes', () => {
    const entry = createOutcomeLedgerEntry();
    applyOutcome(entry, { ok: false, startedAtMs: 10 });
    applyOutcome(entry, { ok: false, startedAtMs: 11 });
    // stale failure from before the first one
    applyOutcome(entry, { ok: false, startedAtMs: 5 });
    expect(entry.consecutiveFailures).toBe(2);
    expect(entry.lastOutcomeAt).toBe(11);
  });

  it('equal start times apply in processing order (documented tie semantics)', () => {
    const entry = createOutcomeLedgerEntry();
    applyOutcome(entry, { ok: true, startedAtMs: 5 });
    expect(applyOutcome(entry, { ok: false, startedAtMs: 5 })).toBe('applied');
    expect(entry.consecutiveFailures).toBe(1);
  });
});
