import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildOpenOrdersByDexMap,
  filterCanceledOpenOrders,
  getScopedOpenOrdersByCoin,
  mergeCachedSpotOpenOrders,
  mergePrimaryPositionsWithCachedDexPositions,
  shouldResetOpenOrdersForAccount,
} from './coldStartMergeUtils';

function order(coin: string, oid: number): IPerpsFrontendOrder {
  return {
    coin,
    oid,
    timestamp: oid,
  } as IPerpsFrontendOrder;
}

function position(coin: string, positionValue: string): IPerpsAssetPosition {
  return {
    position: {
      coin,
      szi: '1',
      positionValue,
    },
  } as IPerpsAssetPosition;
}

describe('coldStartMergeUtils', () => {
  it('groups open orders by dex and filters canceled ids after merge', () => {
    const openOrdersByDex = buildOpenOrdersByDexMap([
      order('BTC', 1),
      order('xyz:NVDA', 2),
      order('@1', 3),
    ]);

    expect(openOrdersByDex).toEqual({
      '': [order('BTC', 1)],
      xyz: [order('xyz:NVDA', 2)],
    });
    expect(
      filterCanceledOpenOrders(
        Object.values(openOrdersByDex).flat(),
        new Set([1]),
      ),
    ).toEqual([order('xyz:NVDA', 2)]);
  });

  it('keeps cached spot orders separate from dex refresh buckets', () => {
    expect(
      mergeCachedSpotOpenOrders({
        activeAccountAddress: '0xABC',
        cachedAccountAddress: '0xabc',
        freshSpotOpenOrders: [order('@1', 1)],
        cachedSpotOpenOrders: [order('@1', 1), order('@2', 2), order('@3', 3)],
        canceledOrderIds: new Set([3]),
      }),
    ).toEqual([order('@1', 1), order('@2', 2)]);
  });

  it('does not reuse cached spot orders from another account', () => {
    expect(
      mergeCachedSpotOpenOrders({
        activeAccountAddress: '0xabc',
        cachedAccountAddress: '0xdef',
        freshSpotOpenOrders: [order('@1', 1)],
        cachedSpotOpenOrders: [order('@2', 2)],
        canceledOrderIds: new Set(),
      }),
    ).toEqual([order('@1', 1)]);
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

  it('preserves cached non-primary dex positions during primary webData2 updates', () => {
    expect(
      mergePrimaryPositionsWithCachedDexPositions({
        activeAccountAddress: '0xABC',
        cachedAccountAddress: '0xabc',
        primaryPositions: [position('BTC', '10')],
        cachedPositions: [position('xyz:NVDA', '20'), position('ETH', '30')],
      }).map((item) => item.position.coin),
    ).toEqual(['xyz:NVDA', 'BTC']);
  });

  it('does not reuse cached dex positions for a different account', () => {
    expect(
      mergePrimaryPositionsWithCachedDexPositions({
        activeAccountAddress: '0xabc',
        cachedAccountAddress: '0xdef',
        primaryPositions: [position('BTC', '10')],
        cachedPositions: [position('xyz:NVDA', '20')],
      }).map((item) => item.position.coin),
    ).toEqual(['BTC']);
  });
});
