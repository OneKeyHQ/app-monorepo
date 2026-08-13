import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import {
  buildSwapProMarketData,
  mergeSwapProTransactions,
} from './swapProMarketDataUtils';

function buildTransaction({
  hash,
  price,
  timestamp,
}: {
  hash: string;
  price: string;
  timestamp: number;
}): IMarketTokenTransaction {
  return {
    pairAddress: '',
    hash,
    owner: '',
    type: 'buy',
    timestamp,
    url: '',
    from: {
      symbol: 'USD',
      amount: '1',
      address: '',
      price: '1',
    },
    to: {
      symbol: 'BTC',
      amount: '1',
      address: '',
      price,
    },
  };
}

describe('swapProMarketDataUtils', () => {
  it('keeps the latest unique transactions when a late snapshot arrives', () => {
    const liveTransaction = buildTransaction({
      hash: 'live',
      price: '64001',
      timestamp: 2,
    });
    const snapshotTransaction = buildTransaction({
      hash: 'snapshot',
      price: '64000',
      timestamp: 1,
    });

    expect(
      mergeSwapProTransactions(
        [snapshotTransaction],
        [liveTransaction, snapshotTransaction],
      ),
    ).toEqual([liveTransaction, snapshotTransaction]);
  });

  it('derives Hyperliquid price from its latest trade only', () => {
    const transaction = buildTransaction({
      hash: 'hl',
      price: '64001',
      timestamp: 2,
    });

    expect(
      buildSwapProMarketData({
        source: 'hyperliquid',
        transactions: [transaction],
        marketSnapshotPrice: '63000',
        hasLoadedSource: true,
      }),
    ).toMatchObject({
      source: 'hyperliquid',
      price: '64001',
    });
  });

  it('does not fall back to Market price when Hyperliquid has no trade', () => {
    expect(
      buildSwapProMarketData({
        source: 'hyperliquid',
        transactions: [],
        marketSnapshotPrice: '63000',
        hasLoadedSource: true,
      }).price,
    ).toBe('');
  });

  it('uses the same-provider Market snapshot until a live trade arrives', () => {
    expect(
      buildSwapProMarketData({
        source: 'market',
        transactions: [],
        marketSnapshotPrice: '3200',
        hasLoadedSource: true,
      }).price,
    ).toBe('3200');
  });
});
