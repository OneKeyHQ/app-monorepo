import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildPositionTpslScopeKey,
  buildPositionTpslSubmission,
  getPositionTpslDex,
  getPositionTpslSnapshotViewState,
  hasPositionTpslSubmission,
  isPositionTpslSnapshotReady,
  selectPositionTpslOrders,
  shouldApplyPositionTpslSnapshotResponse,
} from './positionTpslSnapshot';

function makeOrder(
  overrides: Partial<Omit<IPerpsFrontendOrder, 'orderType'>> & {
    orderType?: string;
  },
): IPerpsFrontendOrder {
  return {
    coin: 'BTC',
    oid: 1,
    orderType: 'Trigger',
    isTrigger: true,
    isPositionTpsl: true,
    triggerCondition: 'Price above 100000',
    triggerPx: '100000',
    side: 'A',
    sz: '0',
    ...overrides,
  } as IPerpsFrontendOrder;
}

describe('position TP/SL snapshot helpers', () => {
  it('selects bare Trigger position TP/SL independent of serialized size', () => {
    const tp = makeOrder({ oid: 1, sz: '3.5' });
    const sl = makeOrder({
      oid: 2,
      sz: '0.0',
      triggerCondition: 'Price below 90000',
      triggerPx: '90000',
    });
    expect(selectPositionTpslOrders([tp, sl], 'BTC')).toEqual({
      tpOrder: tp,
      slOrder: sl,
    });
  });

  it('excludes another coin, normal TP/SL, and unclassified triggers', () => {
    expect(
      selectPositionTpslOrders(
        [
          makeOrder({ coin: 'ETH' }),
          makeOrder({ isPositionTpsl: false }),
          makeOrder({ triggerCondition: '' }),
        ],
        'BTC',
      ),
    ).toEqual({ tpOrder: null, slOrder: null });
  });

  it('maps main and sub-dex scopes without sharing readiness', () => {
    const accountAddress = '0x1111111111111111111111111111111111111111';
    const mainScope = buildPositionTpslScopeKey({
      accountAddress,
      coin: 'BTC',
      positionSize: '1',
      entryPrice: '90000',
      leverage: 5,
    });
    const subDexScope = buildPositionTpslScopeKey({
      accountAddress,
      coin: 'xyz:NVDA',
      positionSize: '1',
      entryPrice: '180',
      leverage: 5,
    });
    expect(getPositionTpslDex('BTC')).toBe('');
    expect(getPositionTpslDex('xyz:NVDA')).toBe('xyz');
    expect(
      isPositionTpslSnapshotReady({
        status: 'ready',
        snapshotScopeKey: mainScope,
        currentScopeKey: subDexScope,
      }),
    ).toBe(false);
    expect(
      isPositionTpslSnapshotReady({
        status: 'loading',
        snapshotScopeKey: subDexScope,
        currentScopeKey: subDexScope,
      }),
    ).toBe(false);
  });

  it('shows a spinner while loading and retry only after an error', () => {
    const scopeKey = 'account|dex|coin|1|100|5';
    expect(
      getPositionTpslSnapshotViewState({
        status: 'ready',
        snapshotScopeKey: scopeKey,
        currentScopeKey: scopeKey,
      }),
    ).toBe('content');
    expect(
      getPositionTpslSnapshotViewState({
        status: 'loading',
        snapshotScopeKey: scopeKey,
        currentScopeKey: scopeKey,
      }),
    ).toBe('loading');
    expect(
      getPositionTpslSnapshotViewState({
        status: 'error',
        snapshotScopeKey: scopeKey,
        currentScopeKey: scopeKey,
      }),
    ).toBe('retry');
    expect(
      getPositionTpslSnapshotViewState({
        status: 'ready',
        snapshotScopeKey: scopeKey,
        currentScopeKey: `${scopeKey}|changed`,
      }),
    ).toBe('loading');
  });

  it('rejects stale request ids and changed account/dex/position scopes', () => {
    expect(
      shouldApplyPositionTpslSnapshotResponse({
        requestId: 1,
        latestRequestId: 2,
        responseScopeKey: 'account|dex|coin|1|100|5',
        currentScopeKey: 'account|dex|coin|1|100|5',
      }),
    ).toBe(false);
    expect(
      shouldApplyPositionTpslSnapshotResponse({
        requestId: 2,
        latestRequestId: 2,
        responseScopeKey: 'account|dex|coin|1|100|5',
        currentScopeKey: 'account|dex|coin|2|100|5',
      }),
    ).toBe(false);
  });

  it('strips legs found by the submit-time snapshot and detects no-op', () => {
    const tpOrder = makeOrder({ oid: 1 });
    const slOrder = makeOrder({
      oid: 2,
      triggerCondition: 'Price below 90000',
    });
    expect(
      buildPositionTpslSubmission({
        orders: { tpOrder, slOrder: null },
        tpTriggerPx: '100000',
        slTriggerPx: '90000',
      }),
    ).toEqual({ tpTriggerPx: undefined, slTriggerPx: '90000' });
    expect(
      hasPositionTpslSubmission(
        buildPositionTpslSubmission({
          orders: { tpOrder, slOrder },
          tpTriggerPx: '100000',
          slTriggerPx: '90000',
        }),
      ),
    ).toBe(false);
  });
});
