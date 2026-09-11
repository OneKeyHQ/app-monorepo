import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EBorrowActionsEnum,
  EBorrowProviderEnum,
  EEarnLabels,
} from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  buildBorrowHistoryListItemKey,
  getBorrowHistoryActionForLocalTx,
} from './borrowHistoryList.utils';

const buildLocalBorrowTx = (tags: string[]): IAccountHistoryTx =>
  ({
    id: 'history-id',
    decodedTx: {
      txid: 'tx-hash',
      networkId: 'evm--1',
      accountId: 'account-id',
      status: EDecodedTxStatus.Pending,
      actions: [],
      nonce: 0,
      owner: 'owner',
      signer: 'signer',
      extraInfo: null,
    },
    stakingInfo: {
      protocol: 'Aave',
      label: EEarnLabels.Borrow,
      tags,
    },
  }) as IAccountHistoryTx;

const marketParams = {
  provider: EBorrowProviderEnum.Aave,
  networkId: 'evm--1',
  marketAddress: '0xMarket',
};

describe('getBorrowHistoryActionForLocalTx', () => {
  it('recognizes a scoped setCollateral transaction for its market', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: buildLocalBorrowTx([
          'Borrow',
          'borrow:aave:setCollateral',
          'borrow:aave:setCollateral:v1:evm--1:0xmarket:0xusde',
        ]),
        ...marketParams,
      }),
    ).toBe('setCollateral');
  });

  it('does not leak a scoped setCollateral transaction to another market', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: buildLocalBorrowTx([
          'borrow:aave:setCollateral:v1:evm--1:0xother-market:0xusde',
        ]),
        ...marketParams,
      }),
    ).toBeUndefined();
  });

  it('recognizes other structured borrow actions', () => {
    expect(
      getBorrowHistoryActionForLocalTx({
        tx: buildLocalBorrowTx(['borrow:aave:setEMode']),
        ...marketParams,
      }),
    ).toBe('setEMode');
  });
});

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
        type: EBorrowActionsEnum.Withdraw,
        direction: 'receive',
      }),
    ).not.toBe(
      buildBorrowHistoryListItemKey({
        ...sharedFields,
        title: '偿还',
        amount: '0.09078',
        tokenAddress: 'usdc-token',
        type: EBorrowActionsEnum.Repay,
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
      type: EBorrowActionsEnum.Borrow,
      direction: 'receive' as const,
    };

    expect(buildBorrowHistoryListItemKey(item)).toBe(
      buildBorrowHistoryListItemKey(item),
    );
  });
});
