import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  dustSweepReducer,
  getDustSweepProgress,
  getDustSweepSelectionSummary,
  initialDustSweepSession,
} from './stateMachine';

const token = (key: string, hidden = false) =>
  ({
    $key: key,
    address: key,
    contractAddress: key,
    decimals: 18,
    isNative: false,
    name: key,
    symbol: key,
    fiatValue: '0.01',
    hidden,
  }) as unknown as IAccountToken & { fiatValue: string; hidden?: boolean };

describe('dustSweepReducer', () => {
  it('keeps selection semantics explicit, including indeterminate state', () => {
    let state = dustSweepReducer(initialDustSweepSession, {
      type: 'hydrate',
      candidates: [token('a'), token('b'), token('hidden', true)],
      generation: 1,
    });
    state = dustSweepReducer(state, { type: 'toggle', key: 'a' });
    expect(getDustSweepSelectionSummary(state)).toMatchObject({
      selectedCount: 1,
      selectableCount: 2,
      indeterminate: true,
      allSelected: false,
    });
    state = dustSweepReducer(state, { type: 'add_hidden' });
    expect(state.selectedKeys).toEqual(['a', 'hidden']);
  });

  it('does not count a broadcast as a terminal success', () => {
    let state = dustSweepReducer(initialDustSweepSession, {
      type: 'hydrate',
      candidates: [token('a')],
      generation: 1,
    });
    state = dustSweepReducer(state, { type: 'toggle', key: 'a' });
    state = dustSweepReducer(state, {
      type: 'start',
      targetToken: token('target'),
    });
    state = dustSweepReducer(state, { type: 'begin_item', key: 'a' });
    state = dustSweepReducer(state, { type: 'broadcast_item', key: 'a' });
    expect(getDustSweepProgress(state)).toMatchObject({
      completed: 0,
      success: 0,
    });
    state = dustSweepReducer(state, {
      type: 'settle_item',
      key: 'a',
      receivedAmount: '1',
    });
    expect(state.stage).toBe('completed');
    expect(getDustSweepProgress(state)).toMatchObject({
      completed: 1,
      success: 1,
    });
  });

  it('pauses only between items and preserves terminal item state', () => {
    let state = dustSweepReducer(initialDustSweepSession, {
      type: 'hydrate',
      candidates: [token('a'), token('b')],
      generation: 1,
    });
    state = dustSweepReducer(state, { type: 'toggle_all' });
    state = dustSweepReducer(state, {
      type: 'start',
      targetToken: token('target'),
    });
    state = dustSweepReducer(state, { type: 'begin_item', key: 'a' });
    state = dustSweepReducer(state, { type: 'pause' });
    state = dustSweepReducer(state, {
      type: 'settle_item',
      key: 'a',
      receivedAmount: '1',
    });
    expect(state.stage).toBe('paused');
    expect(state.items.find((item) => item.key === 'a')?.status).toBe(
      'success',
    );
    state = dustSweepReducer(state, { type: 'resume' });
    expect(state.stage).toBe('running');
  });
});
