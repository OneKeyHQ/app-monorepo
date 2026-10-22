import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  type ILocalHistory,
  SimpleDbEntityLocalHistory,
} from './SimpleDbEntityLocalHistory';

const networkId = 'evm--1';
const accountAddress = '0xpayer';
const historyTx: IAccountHistoryTx = {
  id: 'original',
  decodedTx: {
    txid: '0xoriginal',
    accountId: 'account-1',
    networkId,
    owner: accountAddress,
    signer: accountAddress,
    nonce: 5,
    status: EDecodedTxStatus.Pending,
    actions: [],
    extraInfo: null,
    encodedTx: {
      from: accountAddress,
      to: '0xinvoice',
      value: '0x1',
      nonce: 5,
    },
  },
};
const key = accountUtils.buildAccountLocalAssetsKey({
  networkId,
  accountAddress,
});

describe('restoring hidden pending history', () => {
  it.each(['absent', 'pending', 'confirmed', 'replacement'] as const)(
    'inserts only a missing original, checking the current locked snapshot: %s',
    async (state) => {
      let data: ILocalHistory = { pendingTxs: {}, confirmedTxs: {} };
      const entity = new SimpleDbEntityLocalHistory();
      jest.spyOn(entity, 'setRawData').mockImplementation(async (updater) => {
        // Simulate another history writer winning the race before our lock.
        if (state === 'pending') data.pendingTxs[key] = [historyTx];
        if (state === 'confirmed')
          data.confirmedTxs[key] = [
            {
              ...historyTx,
              decodedTx: {
                ...historyTx.decodedTx,
                status: EDecodedTxStatus.Confirmed,
              },
            },
          ];
        if (state === 'replacement')
          data.pendingTxs[key] = [
            { ...historyTx, id: 'cancel', replacedPrevId: historyTx.id },
          ];
        data = typeof updater === 'function' ? await updater(data) : updater;
        return data;
      });
      await expect(
        entity.restoreLocalHistoryPendingTx({
          networkId,
          accountAddress,
          historyTx,
        }),
      ).resolves.toBe(state === 'absent');
      if (state === 'confirmed') expect(data.pendingTxs[key]).toBeUndefined();
      else expect(data.pendingTxs[key]).toHaveLength(1);
      if (state === 'replacement')
        expect(data.pendingTxs[key][0].id).toBe('cancel');
    },
  );
});
