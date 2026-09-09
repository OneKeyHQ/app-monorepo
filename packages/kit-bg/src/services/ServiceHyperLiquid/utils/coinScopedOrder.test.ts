import {
  buildCoinScopedOrderOpenParams,
  getOrderOpenGrouping,
} from './coinScopedOrder';

describe('coin-scoped order helpers', () => {
  it('uses the target coin asset id and never opens reduce-only', () => {
    expect(
      buildCoinScopedOrderOpenParams({
        assetId: 11_000,
        params: {
          coin: 'xyz:NVDA',
          expectedAccountAddress: '0x1111111111111111111111111111111111111111',
          isBuy: true,
          size: '0.1234',
          price: '180.25',
          orderType: 'limit',
          tif: 'Alo',
        },
      }),
    ).toEqual({
      assetId: 11_000,
      isBuy: true,
      size: '0.1234',
      price: '180.25',
      type: 'limit',
      tif: 'Alo',
      tpTriggerPx: undefined,
      slTriggerPx: undefined,
      slippage: undefined,
      reduceOnly: false,
    });
  });

  it('preserves attached TP/SL and switches grouping only when present', () => {
    expect(
      buildCoinScopedOrderOpenParams({
        assetId: 1,
        params: {
          coin: 'ETH',
          expectedAccountAddress: '0x1111111111111111111111111111111111111111',
          isBuy: false,
          size: '1',
          price: '3000',
          orderType: 'market',
          tpTriggerPx: '2800',
          slTriggerPx: '3200',
        },
      }),
    ).toMatchObject({
      type: 'market',
      tif: undefined,
      tpTriggerPx: '2800',
      slTriggerPx: '3200',
      reduceOnly: false,
    });
    expect(getOrderOpenGrouping(1)).toBe('na');
    expect(getOrderOpenGrouping(2)).toBe('normalTpsl');
    expect(getOrderOpenGrouping(3)).toBe('normalTpsl');
  });
});
