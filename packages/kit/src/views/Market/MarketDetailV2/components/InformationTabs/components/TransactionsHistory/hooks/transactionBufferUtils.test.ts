import { createMockTransaction } from '../__tests__/fixtures';

import {
  appendBufferedTransaction,
  mergeUniqueTransactions,
} from './transactionBufferUtils';

describe('transactionBufferUtils', () => {
  it('merges transactions by timestamp and removes duplicate hashes', () => {
    expect(
      mergeUniqueTransactions([
        createMockTransaction('old', 1),
        createMockTransaction('new', 3),
        createMockTransaction('old', 2),
      ]).map((tx) => tx.hash),
    ).toEqual(['new', 'old']);
  });

  it('skips buffered transactions already present in the live list', () => {
    const currentTransactions = [createMockTransaction('existing', 1)];
    const result = appendBufferedTransaction({
      bufferedTransactions: [],
      currentTransactions,
      transaction: createMockTransaction('existing', 2),
      maxBufferSize: 2,
    });

    expect(result.bufferedTransactions).toEqual([]);
    expect(result.isOverflow).toBe(false);
  });

  it('caps buffered entries to the newest items after crossing the overflow threshold', () => {
    const result = appendBufferedTransaction({
      bufferedTransactions: [
        createMockTransaction('1', 1),
        createMockTransaction('2', 2),
      ],
      currentTransactions: [],
      transaction: createMockTransaction('3', 3),
      maxBufferSize: 2,
    });

    expect(result.bufferedTransactions.map((tx) => tx.hash)).toEqual([
      '3',
      '2',
    ]);
    expect(result.isOverflow).toBe(true);
  });
});
