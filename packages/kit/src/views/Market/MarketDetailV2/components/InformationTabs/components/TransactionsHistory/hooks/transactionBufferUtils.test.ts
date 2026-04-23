import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import {
  appendBufferedTransaction,
  mergeUniqueTransactions,
} from './transactionBufferUtils';

function buildTx(hash: string, timestamp: number): IMarketTokenTransaction {
  return {
    pairAddress: 'pair',
    hash,
    owner: 'owner',
    type: 'buy',
    timestamp,
    url: '',
    from: {
      symbol: 'ETH',
      amount: '1',
      address: '0xeth',
      price: '1',
    },
    to: {
      symbol: 'USDT',
      amount: '1',
      address: '0xusdt',
      price: '1',
    },
  };
}

describe('transactionBufferUtils', () => {
  it('merges transactions by timestamp and removes duplicate hashes', () => {
    expect(
      mergeUniqueTransactions([
        buildTx('old', 1),
        buildTx('new', 3),
        buildTx('old', 2),
      ]).map((tx) => tx.hash),
    ).toEqual(['new', 'old']);
  });

  it('skips buffered transactions already present in the live list', () => {
    const currentTransactions = [buildTx('existing', 1)];
    const result = appendBufferedTransaction({
      bufferedTransactions: [],
      currentTransactions,
      transaction: buildTx('existing', 2),
      maxBufferSize: 2,
    });

    expect(result.bufferedTransactions).toEqual([]);
    expect(result.isOverflow).toBe(false);
  });

  it('keeps the newest buffered entries when the buffer overflows', () => {
    const result = appendBufferedTransaction({
      bufferedTransactions: [buildTx('1', 1), buildTx('2', 2)],
      currentTransactions: [],
      transaction: buildTx('3', 3),
      maxBufferSize: 2,
    });

    expect(result.bufferedTransactions.map((tx) => tx.hash)).toEqual([
      '2',
      '3',
    ]);
    expect(result.isOverflow).toBe(true);
  });
});
