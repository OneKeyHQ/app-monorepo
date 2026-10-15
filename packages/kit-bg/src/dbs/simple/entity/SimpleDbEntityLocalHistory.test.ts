import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  SimpleDbEntityLocalHistory,
  canPersistLocalHistoryTx,
} from './SimpleDbEntityLocalHistory';

function tx(
  side?: IAccountHistoryTx['privacyChainHistorySide'],
  poolIds?: number[],
): IAccountHistoryTx {
  return {
    id: 'history-id',
    decodedTx: { networkId: getNetworkIdsMap().zec },
    privacyChainHistorySide: side,
    privacyChainHistoryPoolIds: poolIds,
  } as IAccountHistoryTx;
}

describe('local wallet history persistence boundary', () => {
  it('keeps public-side rows and rows without a side marker', () => {
    for (const row of [tx('public', [0]), tx()]) {
      expect(
        canPersistLocalHistoryTx({
          networkId: getNetworkIdsMap().zec,
          tx: row,
        }),
      ).toBe(true);
    }
  });

  it('never persists private, mixed, or unmarked runtime rows', () => {
    for (const row of [
      tx('private', [4]),
      tx('mixed', [0, 4]),
      tx(undefined, []),
      tx(undefined, [0]),
    ]) {
      expect(
        canPersistLocalHistoryTx({
          networkId: getNetworkIdsMap().zec,
          tx: row,
        }),
      ).toBe(false);
    }
  });

  it('does not change persistence rules for other networks', () => {
    expect(
      canPersistLocalHistoryTx({
        networkId: getNetworkIdsMap().btc,
        tx: tx(),
      }),
    ).toBe(true);
  });
});

describe('pending history timestamps', () => {
  it('preserves submission time across refreshes and restores an older journal time', async () => {
    let stored: unknown = null;
    const entity = new SimpleDbEntityLocalHistory();
    (entity as { appStorage: unknown }).appStorage = {
      getItem: async () => stored,
      setItem: async (_key: string, value: unknown) => {
        stored = value;
      },
    };
    const params = {
      networkId: getNetworkIdsMap().zec,
      accountAddress: 't1-test',
    };
    const pending = {
      ...tx('public', [0]),
      decodedTx: {
        ...tx().decodedTx,
        status: EDecodedTxStatus.Pending,
        createdAt: 1000,
        updatedAt: 1000,
      },
    };
    await entity.saveLocalHistoryTxs({ ...params, pendingTxs: [pending] });
    await entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [
        {
          ...pending,
          decodedTx: { ...pending.decodedTx, createdAt: 2000, updatedAt: 2000 },
        },
      ],
    });
    expect(
      (await entity.getAccountLocalHistoryPendingTxs(params))[0].decodedTx,
    ).toMatchObject({ createdAt: 1000, updatedAt: 1000 });
    await entity.saveLocalHistoryTxs({
      ...params,
      pendingTxs: [
        {
          ...pending,
          decodedTx: { ...pending.decodedTx, createdAt: 500, updatedAt: 500 },
        },
      ],
    });
    expect(
      (await entity.getAccountLocalHistoryPendingTxs(params))[0].decodedTx,
    ).toMatchObject({ createdAt: 500, updatedAt: 500 });
  });
});
