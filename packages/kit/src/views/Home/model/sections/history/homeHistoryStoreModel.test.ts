import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { selectRecentHomeHistoryRows } from './homeHistoryStoreModel';

function history(id: string, status: EDecodedTxStatus): IAccountHistoryTx {
  return {
    id,
    decodedTx: { status },
  } as unknown as IAccountHistoryTx;
}

describe('Home History Store selectors', () => {
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
