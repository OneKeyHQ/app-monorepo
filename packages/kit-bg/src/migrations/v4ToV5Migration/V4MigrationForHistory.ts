import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { buildLocalHistoryKey } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { EV4LocalDBStoreNames } from './v4local/v4localDBStoreNames';
import { V4MigrationManagerBase } from './V4MigrationManagerBase';

import type { IV4DBAccount, IV4DBUtxoAccount } from './v4local/v4localDBTypes';
import type { IV4EncodedTx, IV4EncodedTxBtc, IV4HistoryTx } from './v4types';

export class V4MigrationForHistory extends V4MigrationManagerBase {
  async getV4Account({ accountId }: { accountId: string }) {
    const r = await this.v4dbHubs.v4localDb.getAllRecords({
      name: EV4LocalDBStoreNames.Account,
      ids: [accountId],
    });
    const v4accounts: IV4DBAccount[] = r?.records || [];
    return v4accounts.filter(Boolean)[0];
  }

  async getV4PendingTxsOfAccount({ v4account }: { v4account: IV4DBAccount }) {
    const localPendingHistory =
      await this.v4dbHubs.v4simpleDb.history.getAccountHistory({
        accountId: v4account.id,
        isPending: true,
      });

    return localPendingHistory;
  }

  convertV4EncodedTxToV5({
    encodedTx,
    networkId,
  }: {
    encodedTx: IV4EncodedTx;
    networkId: string;
  }) {
    const networkIdsMap = getNetworkIdsMap();

    switch (networkId) {
      case networkIdsMap.btc:
      case networkIdsMap.tbtc:
      case networkIdsMap.bch:
      case networkIdsMap.ltc:
      case networkIdsMap.doge:
      case networkIdsMap.neurai:
        return this.convertV4BtcForkEncodedTxToV5(encodedTx);

      default:
        return encodedTx as IEncodedTx;
    }
  }

  convertV4BtcForkEncodedTxToV5(v4EncodedTx: IV4EncodedTx) {
    const v4EncodedTxBtc = v4EncodedTx as IV4EncodedTxBtc;
    const v5EncodedTx: IEncodedTxBtc = {
      inputs: v4EncodedTxBtc.inputs,
      outputs: v4EncodedTxBtc.outputs,
      inputsForCoinSelect: v4EncodedTxBtc.inputsForCoinSelect,
      outputsForCoinSelect: v4EncodedTxBtc.outputsForCoinSelect,
      fee: v4EncodedTxBtc.totalFee,
      psbtHex: v4EncodedTxBtc.psbtHex,
      inputsToSign: v4EncodedTxBtc.inputsToSign,
    };
    return v5EncodedTx;
  }

  async convertV4PendingTxsToV5({
    v4pendingTxs,
  }: {
    v4pendingTxs: IV4HistoryTx[];
  }) {
    const { serviceSend } = this.backgroundApi;
    const v5pendingTxs: Record<
      string,
      {
        txs: IAccountHistoryTx[];
        accountAddress: string;
        xpub: string;
        networkId: string;
      }
    > = {};
    for (const v4pendingTx of v4pendingTxs) {
      const { decodedTx: v4decodedTx } = v4pendingTx;
      if (v4decodedTx && v4decodedTx.encodedTx) {
        const v4Account = await this.getV4Account({
          accountId: v4decodedTx.accountId,
        });

        if (v4Account) {
          try {
            const v5EncodedTx = this.convertV4EncodedTxToV5({
              encodedTx: v4decodedTx.encodedTx,
              networkId: v4decodedTx.networkId,
            });

            const v5DecodedTx = await serviceSend.buildDecodedTx({
              accountId: v4decodedTx.accountId,
              networkId: v4decodedTx.networkId,
              unsignedTx: {
                encodedTx: v5EncodedTx,
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
                txid: v4decodedTx.txid,
              },
            };

            const key = buildLocalHistoryKey({
              networkId: v4decodedTx.networkId,
              accountAddress: v4Account.address,
              xpub: (v4Account as IV4DBUtxoAccount).xpub,
            });

            if (v5pendingTxs[key]) {
              v5pendingTxs[key].txs.push(v5pendingTx);
            } else {
              v5pendingTxs[key] = {
                txs: [v5pendingTx],
                accountAddress: v4Account.address,
                xpub: (v4Account as IV4DBUtxoAccount).xpub,
                networkId: v4decodedTx.networkId,
              };
            }
          } catch (e) {
            console.log(e);
          }
        }
      }
    }

    return v5pendingTxs;
  }

  async migrateLocalPendingTxs() {
    const { serviceHistory } = this.backgroundApi;
    const v4pendingTxs =
      await this.v4dbHubs.v4simpleDb.history.getAllPendingTxs();

    if (v4pendingTxs) {
      const v5pendingTxs = await this.convertV4PendingTxsToV5({
        v4pendingTxs,
      });

      for (const item of Object.values(v5pendingTxs)) {
        const { txs, accountAddress, xpub, networkId } = item;
        await serviceHistory.saveLocalHistoryPendingTxs({
          pendingTxs: txs,
          accountAddress,
          xpub,
          networkId,
        });
      }
    }
  }
}
