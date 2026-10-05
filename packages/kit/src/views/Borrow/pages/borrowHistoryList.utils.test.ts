import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import {
  buildBorrowHistoryListItemKey,
  getBorrowHistoryActionForLocalTx,
} from './borrowHistoryList.utils';

function createLocalTx(
  tags: string[],
  replacedType?: EReplaceTxType,
): IAccountHistoryTx {
  return {
    decodedTx: {
      txid: '0xset-collateral',
      networkId: 'evm--1',
    },
    stakingInfo: { tags },
    replacedType,
  } as unknown as IAccountHistoryTx;
}

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

  it('matches a scoped collateral transaction to its market', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: createLocalTx([
          'borrow:aave:setCollateral',
          'borrow:aave:setCollateral:v1:evm--1:0xMarket:0xReserve',
        ]),
        provider: 'AAVE',
        networkId: 'evm--1',
        marketAddress: '0xmarket',
      }),
    ).toBe('setCollateral');
  });

  it('does not leak a scoped collateral transaction into another market', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: createLocalTx([
          'borrow:aave:setCollateral',
          'borrow:aave:setCollateral:v1:evm--1:0xMarket:0xReserve',
        ]),
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0xother-market',
      }),
    ).toBeUndefined();
  });

  it('keeps legacy unscoped collateral transactions visible', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: createLocalTx(['borrow:aave:setCollateral']),
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0xmarket',
      }),
    ).toBe('setCollateral');
  });

  it('ignores collateral transactions from another provider', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: createLocalTx(['borrow:spark:setCollateral']),
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0xmarket',
      }),
    ).toBeUndefined();
  });

  it('does not render a cancellation replacement as a collateral action', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: createLocalTx(['borrow:aave:setCollateral'], EReplaceTxType.Cancel),
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0xmarket',
      }),
    ).toBeUndefined();
  });

  it('keeps a speed-up replacement visible when it carries collateral metadata', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: createLocalTx(
          ['borrow:aave:setCollateral'],
          EReplaceTxType.SpeedUp,
        ),
        provider: 'aave',
        networkId: 'evm--1',
        marketAddress: '0xmarket',
      }),
    ).toBe('setCollateral');
  });
});
