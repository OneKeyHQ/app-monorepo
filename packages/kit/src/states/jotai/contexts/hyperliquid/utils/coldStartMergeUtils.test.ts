import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  filterCanceledOpenOrders,
  getScopedOpenOrdersByCoin,
  shouldResetOpenOrdersForAccount,
} from './coldStartMergeUtils';

function order(coin: string, oid: number): IPerpsFrontendOrder {
  return {
    coin,
    oid,
    timestamp: oid,
  } as IPerpsFrontendOrder;
}

describe('coldStartMergeUtils', () => {
  it('filters canceled ids after open-order cache merges', () => {
    expect(
      filterCanceledOpenOrders(
        [order('BTC', 1), order('xyz:NVDA', 2)],
        new Set([1]),
      ),
    ).toEqual([order('xyz:NVDA', 2)]);
  });

  it('keeps scoped spot orders unmodified when stale webData2 arrives after cache hydration', () => {
    expect(
      shouldResetOpenOrdersForAccount({
        activeAccountAddress: '0xABC',
        currentOpenOrdersAccountAddress: '0xabc',
      }),
    ).toBe(false);
  });

  it('clears scoped spot orders only when perps open orders are reset for the active account', () => {
    expect(
      shouldResetOpenOrdersForAccount({
        activeAccountAddress: '0xabc',
        currentOpenOrdersAccountAddress: '0xdef',
      }),
    ).toBe(true);
  });

  it('returns per-coin orders only when the open-order snapshot is scoped to the active account', () => {
    expect(
      getScopedOpenOrdersByCoin({
        activeAccountAddress: '0xABC',
        openOrdersAccountAddress: '0xabc',
        openOrdersByCoin: {
          BTC: [order('BTC', 1)],
        },
        coin: 'BTC',
      }),
    ).toEqual([order('BTC', 1)]);

    expect(
      getScopedOpenOrdersByCoin({
        activeAccountAddress: '0xabc',
        openOrdersAccountAddress: '0xdef',
        openOrdersByCoin: {
          BTC: [order('BTC', 1)],
        },
        coin: 'BTC',
      }),
    ).toEqual([]);
  });
});
