import {
  IP_TABLE_REQUEST_OUTCOME_FAILURE_CAP,
  applyRequestOutcome,
  createRequestOutcomeState,
  nextIpTableRequestSequence,
} from './ipTableRequestOutcome';

describe('ipTableRequestOutcome', () => {
  it('regression: a newer success applied first blocks an older failure arriving late', () => {
    // Request A starts at t=1 and fails slowly; request B starts at t=5 and
    // succeeds first. B must leave an outcome-ordering mark even though the
    // state was fresh, so A's late failure is rejected as stale.
    const state = createRequestOutcomeState();
    expect(applyRequestOutcome(state, { ok: true, requestSequence: 5 })).toBe(
      'applied',
    );
    expect(applyRequestOutcome(state, { ok: false, requestSequence: 1 })).toBe(
      'stale',
    );
    expect(state.consecutiveFailures).toBe(0);
    expect(state.latestSuccessSequence).toBe(5);
    expect(state.failureSequences).toEqual(new Set());
  });

  it('old failure processed first is overridden by a newer success', () => {
    const state = createRequestOutcomeState();
    expect(applyRequestOutcome(state, { ok: false, requestSequence: 1 })).toBe(
      'applied',
    );
    expect(state.consecutiveFailures).toBe(1);
    expect(applyRequestOutcome(state, { ok: true, requestSequence: 5 })).toBe(
      'applied',
    );
    expect(state.consecutiveFailures).toBe(0);
  });

  it('both interleavings converge to the same final state', () => {
    const a = createRequestOutcomeState();
    applyRequestOutcome(a, { ok: true, requestSequence: 5 });
    applyRequestOutcome(a, { ok: false, requestSequence: 1 });

    const b = createRequestOutcomeState();
    applyRequestOutcome(b, { ok: false, requestSequence: 1 });
    applyRequestOutcome(b, { ok: true, requestSequence: 5 });

    expect(a).toEqual(b);
  });

  it('keeps only failures after a late-arriving success in request order', () => {
    // Request order is failure 1, success 2, failure 3, but completion order
    // is failure 1, failure 3, success 2. The success must still cut off the
    // first failure while preserving the third.
    const state = createRequestOutcomeState();
    applyRequestOutcome(state, { ok: false, requestSequence: 1 });
    applyRequestOutcome(state, { ok: false, requestSequence: 3 });
    expect(applyRequestOutcome(state, { ok: true, requestSequence: 2 })).toBe(
      'applied',
    );
    expect(state.consecutiveFailures).toBe(1);
  });

  it('accumulates unresolved failures regardless of completion order', () => {
    const state = createRequestOutcomeState();
    applyRequestOutcome(state, { ok: false, requestSequence: 10 });
    applyRequestOutcome(state, { ok: false, requestSequence: 11 });
    // This request completed last but is still an unresolved failure: without
    // a later success in request order, it must remain in the set.
    applyRequestOutcome(state, { ok: false, requestSequence: 5 });
    expect(state.consecutiveFailures).toBe(3);
    expect(state.latestSuccessSequence).toBe(0);
    expect(state.failureSequences).toEqual(new Set([10, 11, 5]));
  });

  it('orders requests that start in the same wall-clock millisecond', () => {
    jest.spyOn(Date, 'now').mockReturnValue(5);
    const earlierSequence = nextIpTableRequestSequence();
    const laterSequence = nextIpTableRequestSequence();
    expect(Date.now()).toBe(5);
    expect(laterSequence).toBeGreaterThan(earlierSequence);

    const state = createRequestOutcomeState();
    applyRequestOutcome(state, { ok: true, requestSequence: laterSequence });
    expect(
      applyRequestOutcome(state, {
        ok: false,
        requestSequence: earlierSequence,
      }),
    ).toBe('stale');
    expect(state.consecutiveFailures).toBe(0);
  });

  it('bounds retained failures while keeping the greatest request sequences', () => {
    const state = createRequestOutcomeState();
    const highestSequence = IP_TABLE_REQUEST_OUTCOME_FAILURE_CAP + 5;
    // Insert the greatest sequence first so insertion-order eviction would
    // incorrectly discard it. Retention must be based on request order.
    const completionOrder = [
      highestSequence,
      ...Array.from({ length: highestSequence - 1 }, (_, index) => index + 1),
    ];
    completionOrder.forEach((requestSequence) => {
      applyRequestOutcome(state, { ok: false, requestSequence });
    });

    expect(state.failureSequences.size).toBe(
      IP_TABLE_REQUEST_OUTCOME_FAILURE_CAP,
    );
    expect([...state.failureSequences].toSorted((a, b) => a - b)).toEqual(
      Array.from(
        { length: IP_TABLE_REQUEST_OUTCOME_FAILURE_CAP },
        (_, index) => index + 6,
      ),
    );
    expect(state.consecutiveFailures).toBe(
      IP_TABLE_REQUEST_OUTCOME_FAILURE_CAP,
    );
  });

  it('keeps an exact below-threshold count after pruning with a late success', () => {
    const state = createRequestOutcomeState();
    const highestSequence = IP_TABLE_REQUEST_OUTCOME_FAILURE_CAP + 5;
    for (
      let requestSequence = 1;
      requestSequence <= highestSequence;
      requestSequence += 1
    ) {
      applyRequestOutcome(state, { ok: false, requestSequence });
    }

    applyRequestOutcome(state, {
      ok: true,
      requestSequence: highestSequence - 2,
    });

    expect(state.failureSequences).toEqual(
      new Set([highestSequence - 1, highestSequence]),
    );
    expect(state.consecutiveFailures).toBe(2);
  });
});
