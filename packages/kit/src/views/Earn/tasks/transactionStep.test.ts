import { reduceEarnTransactionStep } from './transactionStep';

import type { IEarnTransactionStepState } from './transactionStep';

const active = (status: IEarnTransactionStepState['status']) => ({
  attemptId: 'attempt-1',
  status,
});
const holdLate = { lateSubmitted: 'unknown' as const };
const handoffLate = { lateSubmitted: 'confirming' as const };

it('separates chain confirmation from postcondition verification', () => {
  const confirmed = reduceEarnTransactionStep(
    active({ type: 'confirming', txid: 'tx' }),
    { type: 'confirmed', attemptId: 'attempt-1' },
    holdLate,
  );
  expect(confirmed).toEqual({
    attemptId: 'attempt-1',
    status: { type: 'verifying', txid: 'tx' },
    advance: false,
  });
  expect(
    reduceEarnTransactionStep(
      active({ type: 'verifying', txid: 'tx' }),
      { type: 'verified', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toEqual({
    attemptId: 'attempt-1',
    status: { type: 'succeeded', txid: 'tx' },
    advance: true,
  });
});

it('records an observed allowance without claiming chain confirmation', () => {
  expect(
    reduceEarnTransactionStep(
      active({ type: 'confirming', txid: 'tx' }),
      { type: 'allowanceSatisfied', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toEqual({
    attemptId: 'attempt-1',
    status: { type: 'allowanceSatisfied', txid: 'tx' },
    advance: true,
  });
  expect(
    reduceEarnTransactionStep(
      active({ type: 'unknown', txid: 'tx', chainConfirmed: false }),
      { type: 'allowanceSatisfied', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toBeUndefined();
  expect(
    reduceEarnTransactionStep(
      active({ type: 'confirming', txid: 'tx' }),
      { type: 'allowanceSatisfied', attemptId: 'other-attempt' },
      holdLate,
    ),
  ).toBeUndefined();
});

it('preserves uncertain sends and requires explicit status recovery', () => {
  expect(
    reduceEarnTransactionStep(
      active({ type: 'sending' }),
      { type: 'cancel', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toEqual({
    attemptId: 'attempt-1',
    status: { type: 'unknown', chainConfirmed: false },
    advance: false,
  });
  const unknown = active({ type: 'unknown', chainConfirmed: false });
  expect(
    reduceEarnTransactionStep(
      unknown,
      { type: 'submitted', attemptId: 'attempt-1', txid: ' tx ' },
      holdLate,
    )?.status,
  ).toEqual({ type: 'unknown', txid: 'tx', chainConfirmed: false });
  expect(
    reduceEarnTransactionStep(
      unknown,
      { type: 'submitted', attemptId: 'attempt-1', txid: ' tx ' },
      handoffLate,
    )?.status,
  ).toEqual({ type: 'confirming', txid: 'tx' });
  expect(
    reduceEarnTransactionStep(
      unknown,
      { type: 'retryStatus', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toBeUndefined();
});

it('rejects stale attempts and contradictory transaction identifiers', () => {
  const state = active({ type: 'confirming', txid: 'tx-1' });
  expect(
    reduceEarnTransactionStep(
      state,
      { type: 'confirmed', attemptId: 'old' },
      holdLate,
    ),
  ).toBeUndefined();
  expect(
    reduceEarnTransactionStep(
      state,
      { type: 'txidConflict', attemptId: 'attempt-1', txid: 'tx-2' },
      holdLate,
    )?.status,
  ).toEqual({
    type: 'unknown',
    chainConfirmed: false,
    txidConflict: ['tx-1', 'tx-2'],
  });
});

it('uses a fresh attempt for retry and makes handoff explicit', () => {
  const failed = active({ type: 'failed', stage: 'beforeSend' });
  expect(
    reduceEarnTransactionStep(
      failed,
      { type: 'retry', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toBeUndefined();
  expect(
    reduceEarnTransactionStep(
      failed,
      { type: 'retry', attemptId: 'attempt-2' },
      holdLate,
    ),
  ).toEqual({
    attemptId: 'attempt-2',
    status: { type: 'preparing' },
    advance: false,
  });
  expect(
    reduceEarnTransactionStep(
      active({ type: 'confirming', txid: 'tx' }),
      { type: 'handoff', attemptId: 'attempt-1' },
      holdLate,
    ),
  ).toEqual({
    attemptId: 'attempt-1',
    status: { type: 'handedOff', txid: 'tx' },
    advance: true,
  });
});
