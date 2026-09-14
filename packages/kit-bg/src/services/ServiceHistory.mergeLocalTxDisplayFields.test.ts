import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import { mergeLocalTxDisplayFields } from './ServiceHistory';

type ITxOverrides = Partial<Omit<IAccountHistoryTx, 'decodedTx'>> & {
  decodedTx?: Partial<IAccountHistoryTx['decodedTx']>;
};

function createTx(overrides: ITxOverrides): IAccountHistoryTx {
  const { decodedTx, ...otherOverrides } = overrides;
  return {
    id: 'history-id',
    ...otherOverrides,
    decodedTx: {
      accountId: 'account-id',
      networkId: 'evm--1',
      txid: '0xcancel',
      actions: [],
      ...decodedTx,
    },
  } as IAccountHistoryTx;
}

describe('mergeLocalTxDisplayFields', () => {
  it('preserves replacement metadata when an indexed cancel replaces the local row', () => {
    const localTx = createTx({
      replacedPrevId: 'previous-history-id',
      replacedType: EReplaceTxType.Cancel,
      stakingInfo: {
        protocol: 'aave',
        label: EEarnLabels.Supply,
        tags: ['borrow:aave:setCollateral'],
      },
    });
    const onChainHistoryTx = createTx({
      decodedTx: {
        accountId: 'account-id',
        networkId: 'evm--1',
        txid: '0xcancel',
        payload: {
          value: '0',
          label: 'Transfer',
          type: EOnChainHistoryTxType.Send,
        },
        actions: [],
      },
    });

    const merged = mergeLocalTxDisplayFields({
      localTx,
      onChainHistoryTx,
    });

    expect(merged.replacedPrevId).toBe('previous-history-id');
    expect(merged.replacedType).toBe(EReplaceTxType.Cancel);
    expect(merged.stakingInfo).toEqual(localTx.stakingInfo);
  });

  it('does not overwrite replacement metadata already supplied by the indexer', () => {
    const merged = mergeLocalTxDisplayFields({
      localTx: createTx({
        replacedPrevId: 'local-previous',
        replacedType: EReplaceTxType.SpeedUp,
      }),
      onChainHistoryTx: createTx({
        replacedPrevId: 'indexed-previous',
        replacedType: EReplaceTxType.Cancel,
        decodedTx: {
          accountId: 'account-id',
          networkId: 'evm--1',
          txid: '0xcancel',
          payload: {
            value: '0',
            label: 'Transfer',
            type: EOnChainHistoryTxType.Send,
          },
          actions: [],
        },
      }),
    });

    expect(merged.replacedPrevId).toBe('indexed-previous');
    expect(merged.replacedType).toBe(EReplaceTxType.Cancel);
  });
});
