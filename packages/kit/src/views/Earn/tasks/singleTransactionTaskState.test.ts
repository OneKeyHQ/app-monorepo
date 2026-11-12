import { createEarnSingleTransactionTaskState } from './singleTransactionTaskState';

const identity = {
  accountId: 'account',
  networkId: 'evm--1',
  provider: 'provider',
};

describe('single transaction task state', () => {
  it.each(['unknown', 'confirming'] as const)(
    'retains the %s policy for a late submission after an unknown outcome',
    (lateSubmitted) => {
      const state = createEarnSingleTransactionTaskState({
        taskId: 'task',
        identity,
        step: { id: 'stake', kind: 'protocol' as const },
        lateSubmitted,
      });
      expect(
        state.dispatchBatch('stake', 'attempt-1', [
          { type: 'start' },
          { type: 'confirmationOpened' },
          { type: 'sendStarted' },
          { type: 'outcomeUnknown' },
        ]),
      ).toBe(true);
      const uncertain = state.getTask();
      expect(state.dispatch('stake', 'older-attempt', { type: 'cancel' })).toBe(
        false,
      );
      expect(state.getTask()).toBe(uncertain);
      expect(
        state.dispatch('stake', 'attempt-1', {
          type: 'submitted',
          txid: 'tx-1',
        }),
      ).toBe(true);
      expect(state.getTask().steps[0].status).toEqual(
        lateSubmitted === 'unknown'
          ? { type: 'unknown', txid: 'tx-1', chainConfirmed: false }
          : { type: 'confirming', txid: 'tx-1' },
      );
    },
  );

  it('shares one lease and commits a single submitted transaction handoff', () => {
    const state = createEarnSingleTransactionTaskState({
      taskId: 'task',
      identity,
      step: { id: 'stake', kind: 'protocol' as const },
      lateSubmitted: 'confirming',
    });
    const owner = Symbol('owner');
    const otherOwner = Symbol('other');
    expect(state.acquire(owner)).toBe(true);
    expect(state.acquire(otherOwner)).toBe(false);
    expect(state.owns(owner)).toBe(true);
    expect(
      state.dispatchBatch('stake', 'attempt-1', [
        { type: 'start' },
        { type: 'confirmationOpened' },
        { type: 'sendStarted' },
        { type: 'submitted', txid: 'tx-1' },
        { type: 'handoff' },
      ]),
    ).toBe(true);
    expect(state.getTask().currentStepIndex).toBe(1);
    expect(state.getTask().steps).toEqual([
      {
        id: 'stake',
        kind: 'protocol',
        attemptId: 'attempt-1',
        status: { type: 'handedOff', txid: 'tx-1' },
      },
    ]);
    state.release(owner);
    expect(state.acquire(otherOwner)).toBe(true);
  });
});
