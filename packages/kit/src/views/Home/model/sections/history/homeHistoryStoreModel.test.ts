import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  getAllNetworksHomeHistoryLimit,
  selectRecentHomeHistoryRows,
  shouldContinueHomeHistoryPagination,
} from './homeHistoryStoreModel';

function history(id: string, status: EDecodedTxStatus): IAccountHistoryTx {
  return {
    id,
    decodedTx: { status },
  } as unknown as IAccountHistoryTx;
}

describe('Home History Store selectors', () => {
  it('expands the All Networks request window by one page at a time', () => {
    expect(getAllNetworksHomeHistoryLimit(undefined)).toBe(50);
    expect(getAllNetworksHomeHistoryLimit(2)).toBe(100);
    expect(getAllNetworksHomeHistoryLimit(3)).toBe(150);
  });

  it('does not require cursor advancement for All Networks limit expansion', () => {
    expect(
      shouldContinueHomeHistoryPagination({
        addedCount: 50,
        cursorAdvanced: false,
        isAllNetworks: true,
        responseCount: 100,
        responseHasMore: true,
      }),
    ).toBe(true);
    expect(
      shouldContinueHomeHistoryPagination({
        addedCount: 0,
        cursorAdvanced: false,
        isAllNetworks: true,
        responseCount: 100,
        responseHasMore: true,
      }),
    ).toBe(false);
  });

  it('still requires cursor advancement for single-network pagination', () => {
    const base = {
      addedCount: 50,
      isAllNetworks: false,
      responseCount: 50,
      responseHasMore: true,
    };
    expect(
      shouldContinueHomeHistoryPagination({
        ...base,
        cursorAdvanced: false,
      }),
    ).toBe(false);
    expect(
      shouldContinueHomeHistoryPagination({
        ...base,
        cursorAdvanced: true,
      }),
    ).toBe(true);
  });

  it('uses one Store list for full History and derives RecentHistory as first-N settled rows', () => {
    const data = [
      history('pending-a', EDecodedTxStatus.Pending),
      history('confirmed-a', EDecodedTxStatus.Confirmed),
      history('pending-b', EDecodedTxStatus.Pending),
      history('confirmed-b', EDecodedTxStatus.Confirmed),
      history('confirmed-c', EDecodedTxStatus.Confirmed),
    ];

    expect(selectRecentHomeHistoryRows(data, undefined)).toEqual(data);
    expect(selectRecentHomeHistoryRows(data, 2).map((tx) => tx.id)).toEqual([
      'pending-a',
      'confirmed-a',
      'pending-b',
      'confirmed-b',
    ]);
  });
});
