import { buildBorrowHistoryListItemKey } from './borrowHistoryList.utils';

describe('borrowHistoryList utils', () => {
  it('builds different keys for records that share the same tx hash', () => {
    const sharedFields = {
      networkId: 'sol--101',
      txHash: 'shared-tx-hash',
      timestamp: 1_742_788_520_000,
    };

    expect(
      buildBorrowHistoryListItemKey({
        ...sharedFields,
        title: '赎回',
        amount: '0.09081',
        tokenAddress: 'usdt-token',
        type: 'withdraw',
        direction: 'receive',
      }),
    ).not.toBe(
      buildBorrowHistoryListItemKey({
        ...sharedFields,
        title: '偿还',
        amount: '0.09078',
        tokenAddress: 'usdc-token',
        type: 'repay',
        direction: 'send',
      }),
    );
  });

  it('returns the same key for the same history item', () => {
    const item = {
      networkId: 'sol--101',
      txHash: 'stable-tx-hash',
      title: '借币',
      amount: '0.4842',
      tokenAddress: 'usdc-token',
      timestamp: 1_742_788_340_000,
      type: 'borrow' as const,
      direction: 'receive' as const,
    };

    expect(buildBorrowHistoryListItemKey(item)).toBe(
      buildBorrowHistoryListItemKey(item),
    );
  });
});
