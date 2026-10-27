import type {
  IDustSweepItem,
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { EDustSweepItemStatus } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  EDustSweepPhase,
  dustSweepReducer,
  getDustSweepPresentation,
  getDustSweepTotals,
  initialDustSweepState,
} from './stateMachine';

const token: IDustSweepToken = {
  key: 'dust',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'DUST',
  decimals: 18,
  amount: '10',
  valueUsd: '1',
  suspicious: false,
};
const snapshot: IDustSweepSnapshot = {
  id: 'session',
  accountId: 'account',
  address: '0xuser',
  networkId: 'evm--1',
  nativeToken: { ...token, contractAddress: '', isNative: true },
  slippage: 5,
  tokens: [token],
};
const identity = {
  type: 'item' as const,
  sessionId: snapshot.id,
  key: token.key,
};

function signingState() {
  let state = dustSweepReducer(initialDustSweepState, {
    type: 'start',
    snapshot,
  });
  state = dustSweepReducer(state, { ...identity, status: 'preparing' });
  state = dustSweepReducer(state, { ...identity, status: 'building' });
  return dustSweepReducer(state, { ...identity, status: 'signing' });
}

describe('Dust Sweep terminal and retry boundaries', () => {
  it.each([
    [EDustSweepItemStatus.Preparing, EDustSweepItemStatus.Skipped],
    [EDustSweepItemStatus.Building, EDustSweepItemStatus.Failed],
    [EDustSweepItemStatus.Signing, EDustSweepItemStatus.Failed],
    [EDustSweepItemStatus.Broadcasted, EDustSweepItemStatus.Failed],
  ] as const)('classifies an error in %s as %s', (stage, expected) => {
    let state = dustSweepReducer(initialDustSweepState, {
      type: 'start',
      snapshot,
    });
    for (const status of [
      EDustSweepItemStatus.Preparing,
      EDustSweepItemStatus.Building,
      EDustSweepItemStatus.Signing,
      EDustSweepItemStatus.Broadcasted,
    ]) {
      state = dustSweepReducer(state, { ...identity, status });
      if (status === stage) break;
    }
    const completed = dustSweepReducer(state, {
      type: 'itemError',
      sessionId: snapshot.id,
      key: token.key,
      providerErrorMessage: 'API error',
    });
    expect(completed.phase).toBe(EDustSweepPhase.Completed);
    expect(completed.items[0]).toMatchObject({
      status: expected,
      providerErrorMessage: 'API error',
    });
    expect(
      dustSweepReducer(completed, {
        ...identity,
        status: EDustSweepItemStatus.Preparing,
      }),
    ).toBe(completed);
  });

  it('requires the quote/build boundary before signing and rejects skipping a built transaction', () => {
    const started = dustSweepReducer(initialDustSweepState, {
      type: 'start',
      snapshot,
    });
    const preparing = dustSweepReducer(started, {
      ...identity,
      status: EDustSweepItemStatus.Preparing,
    });
    expect(
      dustSweepReducer(preparing, {
        ...identity,
        status: EDustSweepItemStatus.Signing,
      }),
    ).toBe(preparing);
    const building = dustSweepReducer(preparing, {
      ...identity,
      status: EDustSweepItemStatus.Building,
    });
    expect(
      dustSweepReducer(building, {
        ...identity,
        status: EDustSweepItemStatus.Skipped,
      }),
    ).toBe(building);
    expect(getDustSweepPresentation(building).active?.status).toBe(
      EDustSweepItemStatus.Building,
    );
  });

  it('does not discard an active item on Stop or accept updates after Leave', () => {
    const signing = signingState();
    const paused = dustSweepReducer(signing, { type: 'pause' });
    expect(dustSweepReducer(paused, { type: 'stop' })).toBe(paused);
    const left = dustSweepReducer(
      dustSweepReducer(signing, { type: 'leave' }),
      { type: 'left' },
    );
    expect(
      dustSweepReducer(left, {
        ...identity,
        status: EDustSweepItemStatus.Broadcasted,
        txId: 'late',
      }),
    ).toBe(left);
    expect(
      dustSweepReducer(left, {
        type: 'submissionError',
        sessionId: snapshot.id,
        key: token.key,
        txId: 'late',
      }),
    ).toBe(left);
  });

  it('only starts one token at a time and cannot bypass quoting without an existing approval', () => {
    const started = dustSweepReducer(initialDustSweepState, {
      type: 'start',
      snapshot: { ...snapshot, tokens: [token, { ...token, key: 'second' }] },
    });
    expect(
      dustSweepReducer(started, {
        ...identity,
        status: EDustSweepItemStatus.Building,
      }),
    ).toBe(started);
    const preparing = dustSweepReducer(started, {
      ...identity,
      status: EDustSweepItemStatus.Preparing,
    });
    expect(
      dustSweepReducer(preparing, {
        ...identity,
        key: 'second',
        status: EDustSweepItemStatus.Preparing,
      }),
    ).toBe(preparing);
    const paused = dustSweepReducer(started, { type: 'pause' });
    expect(
      dustSweepReducer(paused, {
        ...identity,
        status: EDustSweepItemStatus.Preparing,
      }),
    ).toBe(paused);
  });

  it('retains the execution boundary when retrying an already broadcast approval', () => {
    let state = dustSweepReducer(signingState(), {
      type: 'approvalBroadcast',
      sessionId: snapshot.id,
      key: token.key,
      approvalTxIds: ['approval'],
    });
    state = dustSweepReducer(state, {
      ...identity,
      status: EDustSweepItemStatus.Building,
    });
    state = dustSweepReducer(state, {
      ...identity,
      status: EDustSweepItemStatus.Waiting,
    });
    state = dustSweepReducer(state, {
      ...identity,
      status: EDustSweepItemStatus.Building,
    });
    const completed = dustSweepReducer(state, {
      type: 'itemError',
      sessionId: snapshot.id,
      key: token.key,
      reason: 'txFailed',
    });
    expect(completed.items[0]).toMatchObject({
      status: EDustSweepItemStatus.Failed,
      approvalTxIds: ['approval'],
    });
  });

  it('retains already broadcast approvals across a retryable cancellation', () => {
    let state = signingState();
    state = dustSweepReducer(state, {
      type: 'approvalBroadcast',
      sessionId: identity.sessionId,
      key: identity.key,
      approvalTxIds: ['approval-0'],
    });
    expect(state.items[0].status).toBe('signing');
    state = dustSweepReducer(state, { ...identity, status: 'building' });
    state = dustSweepReducer(state, { ...identity, status: 'waiting' });
    expect(state.items[0].status).toBe('waiting');
    expect(state.items[0].approvalTxIds).toEqual(['approval-0']);
    state = dustSweepReducer(state, { type: 'pause' });
    expect(dustSweepReducer(state, { type: 'resume' }).phase).toBe('running');
  });

  it('keeps the signing state after an approval broadcast', () => {
    const state = dustSweepReducer(signingState(), {
      type: 'approvalBroadcast',
      sessionId: identity.sessionId,
      key: identity.key,
      approvalTxIds: ['approval-0'],
    });
    const broadcasted = dustSweepReducer(state, {
      ...identity,
      status: 'broadcasted',
      txId: 'swap-0',
    });
    expect(broadcasted.items[0]).toMatchObject({
      status: 'broadcasted',
      approvalTxIds: ['approval-0'],
      txId: 'swap-0',
    });
  });

  it('retains approval hashes when confirmation fails before swap signing', () => {
    let state = dustSweepReducer(signingState(), {
      type: 'approvalBroadcast',
      sessionId: identity.sessionId,
      key: identity.key,
      approvalTxIds: ['failed-approval'],
    });
    state = dustSweepReducer(state, { ...identity, status: 'building' });
    state = dustSweepReducer(state, {
      ...identity,
      status: 'failed',
      reason: 'txFailed',
    });
    expect(state.items[0]).toMatchObject({
      status: 'failed',
      approvalTxIds: ['failed-approval'],
    });
  });

  it.each(['success', 'failed'] as const)(
    'retains approval hashes in the %s swap details',
    (status) => {
      let state = dustSweepReducer(signingState(), {
        type: 'approvalBroadcast',
        sessionId: identity.sessionId,
        key: identity.key,
        approvalTxIds: ['approval'],
      });
      state = dustSweepReducer(state, {
        ...identity,
        status: 'broadcasted',
        txId: 'swap',
      });
      state = dustSweepReducer(state, {
        ...identity,
        status,
        receivedAmount: status === 'success' ? '1' : undefined,
      });
      expect(state.items[0]).toMatchObject({
        status,
        approvalTxIds: ['approval'],
      });
    },
  );

  it('does not retry an unknown submission or reset it into a new queue', () => {
    let state = dustSweepReducer(signingState(), {
      ...identity,
      status: 'unknown',
    });
    state = dustSweepReducer(state, { type: 'pause' });
    expect(dustSweepReducer(state, { type: 'resume' })).toBe(state);
    expect(dustSweepReducer(state, { type: 'reset' })).toBe(state);
    expect(dustSweepReducer(state, { ...identity, status: 'preparing' })).toBe(
      state,
    );
  });

  it('finishes confirmed success with an explicitly unavailable receipt', () => {
    const broadcasted = dustSweepReducer(signingState(), {
      ...identity,
      status: 'broadcasted',
      txId: 'tx',
    });
    expect(
      dustSweepReducer(broadcasted, { ...identity, status: 'success' }),
    ).toBe(broadcasted);
    const completed = dustSweepReducer(broadcasted, {
      ...identity,
      status: 'success',
      receiptUnavailable: true,
      receivedAmountEstimated: true,
    });
    expect(completed.phase).toBe('completed');
    expect(completed.items[0].receivedAmount).toBeUndefined();
    expect(completed.items[0].receivedAmountEstimated).toBeUndefined();
    expect(getDustSweepTotals(completed.items)).toMatchObject({
      receiptUnavailable: true,
      receivedAmountEstimated: false,
      successCount: 1,
    });
  });

  it('rejects stale session updates and duplicate settlement', () => {
    const broadcasted = dustSweepReducer(signingState(), {
      ...identity,
      status: 'broadcasted',
      txId: 'tx',
    });
    expect(
      dustSweepReducer(broadcasted, {
        ...identity,
        sessionId: 'old',
        status: 'success',
        receivedAmount: '1',
      }),
    ).toBe(broadcasted);
    const completed = dustSweepReducer(broadcasted, {
      ...identity,
      status: 'success',
      receivedAmount: '1',
    });
    expect(
      dustSweepReducer(completed, {
        ...identity,
        status: 'success',
        receivedAmount: '2',
      }),
    ).toBe(completed);
    expect(getDustSweepTotals(completed.items).receivedAmount).toBe('1');
  });

  it('keeps on-chain failures out of the skipped total', () => {
    const items: IDustSweepItem[] = [
      { token, status: 'failed', txId: 'tx-failed', reason: 'txFailed' },
      {
        token: { ...token, key: 'skipped' },
        status: 'skipped',
        reason: 'noQuote',
      },
    ];
    expect(getDustSweepTotals(items)).toMatchObject({
      skippedCount: 1,
      failedCount: 1,
      settledCount: 2,
    });
  });
  it('presents pending and all-skipped sessions without claiming success', () => {
    expect(
      getDustSweepPresentation({
        phase: 'completed',
        snapshot,
        items: [{ token, status: 'skipped', reason: 'noQuote' }],
      }),
    ).toMatchObject({ outcome: 'failed', completed: true });
    expect(
      getDustSweepPresentation({
        phase: 'blocked',
        snapshot,
        items: [{ token, status: 'unknown' }],
      }),
    ).toMatchObject({ outcome: 'pending', unknown: true });
  });
});
