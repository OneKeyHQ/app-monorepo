import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildPositionTpslScopeKey,
  buildPositionTpslSubmission,
  captureInitialPositionTpslScopeKey,
  getPositionTpslDex,
  getPositionTpslScopeChangeErrorTitle,
  hasPositionTpslSubmission,
  selectPositionTpslOrders,
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

  it('maps main and sub-dex scopes independently', () => {
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
    expect(mainScope).not.toBe(subDexScope);
  });

  it('returns visible feedback only when the position scope changes', () => {
    expect(
      getPositionTpslScopeChangeErrorTitle({
        initialScopeKey: 'account|BTC|1',
        currentScopeKey: 'account|BTC|1',
        errorTitle: 'Position changed',
      }),
    ).toBeUndefined();
    expect(
      getPositionTpslScopeChangeErrorTitle({
        initialScopeKey: 'account|BTC|1',
        currentScopeKey: 'account|BTC|2',
        errorTitle: 'Position changed',
      }),
    ).toBe('Position changed');
  });

  it('captures the first non-empty position scope and keeps it stable', () => {
    expect(captureInitialPositionTpslScopeKey('', '')).toBe('');

    const initialScopeKey = captureInitialPositionTpslScopeKey(
      '',
      'account|BTC|1',
    );
    expect(initialScopeKey).toBe('account|BTC|1');
    expect(
      captureInitialPositionTpslScopeKey(initialScopeKey, 'account|BTC|2'),
    ).toBe('account|BTC|1');
  });

  it('strips legs found in subscribed open orders and detects no-op', () => {
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

  it('keeps every leg found at click time or in the latest snapshot', () => {
    const tpOrder = makeOrder({ oid: 1 });
    const slOrder = makeOrder({
      oid: 2,
      triggerCondition: 'Price below 90000',
    });
    expect(
      buildPositionTpslSubmission({
        orders: { tpOrder: null, slOrder },
        latestOrders: { tpOrder, slOrder: null },
        tpTriggerPx: '100000',
        slTriggerPx: '90000',
      }),
    ).toEqual({ tpTriggerPx: undefined, slTriggerPx: undefined });
  });
});
