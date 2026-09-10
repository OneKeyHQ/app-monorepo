import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { canPersistLocalHistoryTx } from './SimpleDbEntityLocalHistory';

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
