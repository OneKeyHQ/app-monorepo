import {
  buildSwapProMarketData,
  mergeSwapProTransactions,
} from './swapProMarketDataUtils';

import type { ISwapProMarketTransaction } from './swapProTransactionSource';

function buildTransaction({
  hash,
  price,
  timestamp,
  timestampMs,
}: {
  hash: string;
  price: string;
  timestamp: number;
  timestampMs?: number;
}): ISwapProMarketTransaction {
  return {
    pairAddress: '',
    hash,
    owner: '',
    type: 'buy',
    timestamp,
    ...(timestampMs ? { timestampMs } : {}),
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

  it('orders transactions in the same second by millisecond precision', () => {
    const olderTransaction = buildTransaction({
      hash: 'older',
      price: '64000',
      timestamp: 1_700_000_000,
      timestampMs: 1_700_000_000_123,
    });
    const newerTransaction = buildTransaction({
      hash: 'newer',
      price: '64001',
      timestamp: 1_700_000_000,
      timestampMs: 1_700_000_000_987,
    });

    expect(
      mergeSwapProTransactions([olderTransaction], [newerTransaction]),
    ).toEqual([newerTransaction, olderTransaction]);
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
