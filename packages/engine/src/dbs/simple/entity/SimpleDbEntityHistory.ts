import { uniqBy } from 'lodash';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';

import { IDecodedTxStatus } from '../../../vaults/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { IDecodedTxAction, IHistoryTx } from '../../../vaults/types';

export type ISimpleDbEntityHistoryData = {
  items: IHistoryTx[];
  lastCleanTime?: number;
};

const MAX_SAVED_HISTORY_COUNT = 1000;
const AUTO_CLEAN_HISTORY_TIME = getTimeDurationMs({ day: 1 });
// const MAX_SAVED_HISTORY_COUNT = 10;
// const AUTO_CLEAN_HISTORY_TIME = getTimeDurationMs({ minute: 1 });

class SimpleDbEntityHistory extends SimpleDbEntityBase<ISimpleDbEntityHistoryData> {
  entityName = 'history';

  // disable full history cache,
  // but add accountHistoryCache instead to save memory
  override enableCache = false;

  async getPendingNonceList(props: {
    accountId: string;
    networkId: string;
  }): Promise<number[]> {
    const { accountId, networkId } = props;
    const { items: pendingTx } = await this.getAccountHistory({
      accountId,
      networkId,
      isPending: true,
    });
    const nonceList = pendingTx.map((item) => item.decodedTx.nonce);
    return nonceList || [];
  }

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

  async getMinPendingNonce(props: {
    accountId: string;
    networkId: string;
  }): Promise<number | null> {
    const nonceList = await this.getPendingNonceList(props);
    if (nonceList.length) {
      const nonce = Math.min(...nonceList);
      if (Number.isNaN(nonce) || nonce === Infinity || nonce === -Infinity) {
        return null;
      }
      return nonce;
    }
    return null;
  }

  _getAccountHistoryInList({
    allData,
    accountId,
    networkId,
  }: {
    allData: IHistoryTx[];
    accountId: string;
    networkId: string;
  }) {
    return allData.filter(
      (item) =>
        item.decodedTx.status !== IDecodedTxStatus.Removed &&
        item.decodedTx.accountId === accountId &&
        item.decodedTx.networkId === networkId,
    );
  }

  accountHistoryCache: {
    accountId?: string;
    networkId?: string;
    items: IHistoryTx[];
  } = {
    items: [],
  };

  _isActionIncludesToken(options: {
    historyTx: IHistoryTx;
    action: IDecodedTxAction;
    tokenIdOnNetwork: string;
  }) {
    const { action, tokenIdOnNetwork, historyTx } = options;

    const {
      tokenTransfer,
      tokenApprove,
      nativeTransfer,
      internalSwap,
      brc20Info,
    } = action;
    return (
      nativeTransfer?.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      tokenTransfer?.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      tokenApprove?.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      internalSwap?.send.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      internalSwap?.receive.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      brc20Info?.token.tokenIdOnNetwork === tokenIdOnNetwork ||
      (historyTx.decodedTx?.tokenIdOnNetwork === tokenIdOnNetwork &&
        tokenIdOnNetwork)
    );
  }

  async getHistoryById(options: {
    accountId?: string;
    networkId?: string;
    id: string;
  }): Promise<IHistoryTx | undefined> {
    const { accountId, networkId, id } = options;
    let list: IHistoryTx[] = [];
    // getAccountHistory() for better performance
    if (accountId && networkId) {
      list = (
        await this.getAccountHistory({
          accountId,
          networkId,
        })
      ).items;
    } else {
      list = (await this.getRawData())?.items || [];
    }
    return list?.find((item) => item.id === id);
  }

  async getAccountHistory(props: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork?: string;
    limit?: number;
    isPending?: boolean;
  }): Promise<{ items: IHistoryTx[] }> {
    const {
      accountId,
      networkId,
      tokenIdOnNetwork,
      isPending,
      limit = HISTORY_CONSTS.GET_LOCAL_LIMIT,
    } = props;
    let items: IHistoryTx[] = [];

    if (
      this.accountHistoryCache.accountId === accountId &&
      this.accountHistoryCache.networkId === networkId &&
      this.accountHistoryCache.items &&
      this.accountHistoryCache.items.length
    ) {
      items = this.accountHistoryCache.items;
    } else {
      const allData = (await this.getRawData())?.items || [];
      items = this._getAccountHistoryInList({
        allData,
        accountId,
        networkId,
      });
      this.accountHistoryCache = {
        accountId,
        networkId,
        items,
      };
    }

    // throw new Error('test');
    items = items
      .sort(
        (b, a) =>
          (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
          (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
      )
      // sort pending tx first
      .sort((a, b) => {
        const num1 = a.decodedTx.status === IDecodedTxStatus.Pending ? -1 : 1;
        const num2 = b.decodedTx.status === IDecodedTxStatus.Pending ? -1 : 1;
        return num1 - num2; // pending to first
        // return num2 - num1; // pending to last
      });

    if (tokenIdOnNetwork || tokenIdOnNetwork === '') {
      items = items.filter(
        (item) =>
          ([] as IDecodedTxAction[])
            .concat(item.decodedTx.actions)
            .concat(item.decodedTx.outputActions || [])
            .filter(
              (action) =>
                action &&
                this._isActionIncludesToken({
                  historyTx: item,
                  action,
                  tokenIdOnNetwork,
                }),
            ).length > 0,
      );
    }

    if (isPending) {
      items = items.filter(
        (item) => item.decodedTx.status === IDecodedTxStatus.Pending,
      );
    }

    items = items.slice(0, limit);

    return {
      items,
    };
  }

  async saveHistoryTx(items: IHistoryTx[]) {
    if (!items || !items.length) {
      return;
    }
    const rawData = await this.getRawData();
    let allData = rawData?.items || [];

    // always keep saved items first, so that cleanHistory won't remove it
    allData = uniqBy([...items, ...allData], (item) => item.id);

    const { accountId, networkId } = this.accountHistoryCache;
    if (accountId && networkId) {
      const items0 = this._getAccountHistoryInList({
        allData,
        accountId,
        networkId,
      });
      this.accountHistoryCache = {
        accountId,
        networkId,
        items: items0,
      };
    }

    setTimeout(() => {
      this.cleanHistory();
    }, 5000);

    // TODO auto remove items in same network and account > 100
    return this.setRawData({
      ...rawData,
      items: allData,
    });
  }

  async cleanHistory() {
    const rawData = await this.getRawData();
    if (!rawData) {
      return;
    }
    const allData = rawData?.items || [];
    if (!allData.length) {
      return;
    }
    const lastCleanTime = rawData?.lastCleanTime || 0;
    if (Date.now() - lastCleanTime < AUTO_CLEAN_HISTORY_TIME) {
      return;
    }

    const allDataCleaned = [];
    let count = 0;
    for (const tx of allData) {
      if (!tx.isLocalCreated) {
        count += 1;
      }
      allDataCleaned.push(tx);
      if (count > MAX_SAVED_HISTORY_COUNT) {
        break;
      }
    }
    await this.setRawData({
      ...rawData,
      items: allDataCleaned,
      lastCleanTime: Date.now(),
    });
  }
}

export { SimpleDbEntityHistory };
