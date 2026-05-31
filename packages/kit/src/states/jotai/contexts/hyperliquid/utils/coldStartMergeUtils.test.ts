import type {
  IPerpsAssetPosition,
  IPerpsFrontendOrder,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildOpenOrdersByDexMap,
  filterCanceledOpenOrders,
  mergePrimaryPositionsWithCachedDexPositions,
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
