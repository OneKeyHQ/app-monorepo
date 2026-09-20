import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';

import {
  dustSweepReducer,
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
  return dustSweepReducer(state, { ...identity, status: 'signing' });
}

describe('Dust Sweep terminal and retry boundaries', () => {
  it('can pause and retry a known password cancellation', () => {
    let state = signingState();
    state = dustSweepReducer(state, { ...identity, status: 'preparing' });
    state = dustSweepReducer(state, { ...identity, status: 'waiting' });
    state = dustSweepReducer(state, { type: 'paused' });
    expect(dustSweepReducer(state, { type: 'resume' }).phase).toBe('running');
  });

  it('does not retry an unknown submission or reset it into a new queue', () => {
    let state = dustSweepReducer(signingState(), {
      ...identity,
      status: 'unknown',
    });
    state = dustSweepReducer(state, { type: 'paused' });
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
    });
    expect(completed.phase).toBe('completed');
    expect(completed.items[0].receivedAmount).toBeUndefined();
    expect(getDustSweepTotals(completed.items)).toMatchObject({
      receiptUnavailable: true,
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
});
