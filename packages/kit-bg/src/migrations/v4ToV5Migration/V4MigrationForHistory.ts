import { isEmpty } from 'lodash';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4DBAccount, IV4DBWallet } from './v4local/v4localDBTypes';
import type { IV4HistoryTx } from './v4types';

export class V4MigrationForHistory extends V4MigrationManagerBase {
  async getV4PendingTxsOfAccount({ v4account }: { v4account: IV4DBAccount }) {
    const localPendingHistory =
      await this.v4dbHubs.v4simpleDb.history.getAccountHistory({
        accountId: v4account.id,
        isPending: true,
      });

    return localPendingHistory;
  }

  async convertV4PendingTxsToV5({
    v4pendingTxs,
  }: {
    v4pendingTxs: IV4HistoryTx[];
  }) {
    const { serviceSend } = this.backgroundApi;
    const v5pendingTxs = [];
    for (const v4pendingTx of v4pendingTxs) {
      const { decodedTx } = v4pendingTx;
      if (decodedTx && decodedTx.encodedTx) {
        try {
          const v5DecodedTx = await serviceSend.buildDecodedTx({
            accountId: decodedTx.accountId,
            networkId: decodedTx.networkId,
            unsignedTx: {
              encodedTx: decodedTx.encodedTx as IEncodedTx,
            },
          });

          const v5pendingTx: IAccountHistoryTx = {
            id: v4pendingTx.id,
            isLocalCreated: v4pendingTx.isLocalCreated,
            replacedNextId: v4pendingTx.replacedNextId,
            replacedPrevId: v4pendingTx.replacedPrevId,
            replacedType: v4pendingTx.replacedType,

            decodedTx: {
              ...v5DecodedTx,
              txid: decodedTx.txid,
            },
          };

          v5pendingTxs.push(v5pendingTx);
        } catch (e) {
          console.log(e);
        }
      }
    }

    return v5pendingTxs;
  }

  async migrateLocalPendingTxs({ v4wallet }: { v4wallet: IV4DBWallet }) {
    const { serviceHistory } = this.backgroundApi;
    const v4accounts = await this.getV4AccountsOfWallet({
      v4wallet,
    });
    for (const v4account of v4accounts) {
      const v4pendingTxs = await this.getV4PendingTxsOfAccount({
        v4account,
      });

      if (v4pendingTxs && !isEmpty(v4pendingTxs.items)) {
        const v5pendingTxs = await this.convertV4PendingTxsToV5({
          v4pendingTxs: v4pendingTxs.items,
        });

        await serviceHistory.saveLocalHistoryPendingTxs({
          pendingTxs: v5pendingTxs,
        });
      }
    }
  }
}
