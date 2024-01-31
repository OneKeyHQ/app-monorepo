import { uniqBy } from 'lodash';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

const MAX_SAVED_HISTORY_COUNT = 1000;
const AUTO_CLEAN_HISTORY_TIME = getTimeDurationMs({ day: 1 });

export interface ILocalHistory {
  txs: IAccountHistoryTx[];
  lastCleanTime?: number;
}

export class SimpleDbEntityLocalHistory extends SimpleDbEntityBase<ILocalHistory> {
  entityName = 'localHistory';

  // disable full history cache,
  // but add accountHistoryCache instead to save memory
  override enableCache = false;

  accountHistoryCache: {
    accountId?: string;
    networkId?: string;
    txs: IAccountHistoryTx[];
  } = {
    txs: [],
  };

  _getAccountLocalHistory(params: {
    accountId: string;
    networkId: string;
    allTxs: IAccountHistoryTx[];
  }) {
    const { accountId, networkId, allTxs } = params;
    return allTxs.filter(
      (tx) =>
        tx.decodedTx.status !== EDecodedTxStatus.Removed &&
        tx.decodedTx.accountId === accountId &&
        tx.decodedTx.networkId === networkId,
    );
  }

  _checkIsActionIncludesToken(params: {
    historyTx: IAccountHistoryTx;
    action: IDecodedTxAction;
    tokenIdOnNetwork: string;
  }) {
    const { action, tokenIdOnNetwork, historyTx } = params;

    const { assetTransfer, tokenApprove } = action;

    return (
      assetTransfer?.sends.find(
        (send) => send.tokenIdOnNetwork === tokenIdOnNetwork,
      ) ||
      assetTransfer?.receives.find(
        (receive) => receive.tokenIdOnNetwork === tokenIdOnNetwork,
      ) ||
      tokenApprove?.tokenIdOnNetwork === tokenIdOnNetwork ||
      (historyTx.decodedTx?.tokenIdOnNetwork === tokenIdOnNetwork &&
        tokenIdOnNetwork)
    );
  }

  @backgroundMethod()
  public async saveLocalHistoryTxs(txs: IAccountHistoryTx[]) {
    if (!txs || !txs.length) return;
    const rawData = await this.getRawData();

    let allTxs = rawData?.txs ?? [];

    allTxs = uniqBy([...txs, ...allTxs], (tx) => tx.id);

    const { accountId, networkId } = this.accountHistoryCache;
    if (accountId && networkId) {
      const items = this._getAccountLocalHistory({
        allTxs,
        accountId,
        networkId,
      });
      this.accountHistoryCache = {
        accountId,
        networkId,
        txs: items,
      };
    }

    setTimeout(() => {
      void this.cleanHistory();
    }, 5000);

    return this.setRawData({
      ...rawData,
      txs: allTxs,
    });
  }

  @backgroundMethod()
  public async getAccountLocalHistory(params: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork?: string;
    isPending?: boolean;
    limit?: number;
  }) {
    const { accountId, networkId, isPending, tokenIdOnNetwork, limit } = params;
    let txs: IAccountHistoryTx[] = [];

    if (
      this.accountHistoryCache.accountId === accountId &&
      this.accountHistoryCache.networkId === networkId &&
      this.accountHistoryCache.txs &&
      this.accountHistoryCache.txs.length
    ) {
      txs = this.accountHistoryCache.txs;
    } else {
      const allTxs = (await this.getRawData())?.txs || [];
      txs = this._getAccountLocalHistory({
        allTxs,
        accountId,
        networkId,
      });
      this.accountHistoryCache = {
        accountId,
        networkId,
        txs,
      };
    }

    txs = txs
      .sort(
        (b, a) =>
          (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
          (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
      )
      .sort((a, b) => {
        const num1 = a.decodedTx.status === EDecodedTxStatus.Pending ? -1 : 1;
        const num2 = b.decodedTx.status === EDecodedTxStatus.Pending ? -1 : 1;
        return num1 - num2; // pending to first
      });

    if (tokenIdOnNetwork || tokenIdOnNetwork === '') {
      txs = txs.filter(
        (tx) =>
          ([] as IDecodedTxAction[])
            .concat(tx.decodedTx.actions)
            .concat(tx.decodedTx.outputActions || [])
            .filter(
              (action) =>
                action &&
                this._checkIsActionIncludesToken({
                  historyTx: tx,
                  action,
                  tokenIdOnNetwork,
                }),
            ).length > 0,
      );
    }

    if (isPending) {
      txs = txs.filter(
        (tx) => tx.decodedTx.status === EDecodedTxStatus.Pending,
      );
    }

    txs = txs.slice(0, limit);

    return txs;
  }

  @backgroundMethod()
  async getPendingNonceList(props: {
    accountId: string;
    networkId: string;
  }): Promise<number[]> {
    const { accountId, networkId } = props;
    const pendingTxs = await this.getAccountLocalHistory({
      accountId,
      networkId,
      isPending: true,
    });
    const nonceList = pendingTxs.map((tx) => tx.decodedTx.nonce);
    return nonceList || [];
  }

  @backgroundMethod()
  async getMaxPendingNonce(props: {
    accountId: string;
    networkId: string;
  }): Promise<number | null> {
    const nonceList = await this.getPendingNonceList(props);
    if (nonceList.length) {
      const nonce = Math.max(...nonceList);
      if (Number.isNaN(nonce) || nonce === Infinity || nonce === -Infinity) {
        return null;
      }
      return nonce;
    }
    return null;
  }

  async cleanHistory() {
    const rawData = await this.getRawData();
    if (!rawData) {
      return;
    }
    const allTxs = rawData?.txs || [];
    if (!allTxs.length) {
      return;
    }
    const lastCleanTime = rawData?.lastCleanTime || 0;
    if (Date.now() - lastCleanTime < AUTO_CLEAN_HISTORY_TIME) {
      return;
    }

    const allTxsCleaned = [];
    let count = 0;
    for (const tx of allTxs) {
      if (!tx.isLocalCreated) {
        count += 1;
      }
      allTxsCleaned.push(tx);
      if (count > MAX_SAVED_HISTORY_COUNT) {
        break;
      }
    }
    await this.setRawData({
      ...rawData,
      txs: allTxsCleaned,
      lastCleanTime: Date.now(),
    });
  }
}
