import { uniqBy } from 'lodash';

import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { EV4DecodedTxStatus } from '../../v4types';
import { V4SimpleDbEntityBase } from '../V4SimpleDbEntityBase';

import type { IV4DecodedTxAction, IV4HistoryTx } from '../../v4types';

const MAX_SAVED_HISTORY_COUNT = 1000;
const AUTO_CLEAN_HISTORY_TIME = timerUtils.getTimeDurationMs({ day: 1 });
// const MAX_SAVED_HISTORY_COUNT = 10;
// const AUTO_CLEAN_HISTORY_TIME = getTimeDurationMs({ minute: 1 });

type IV4SimpleDbEntityHistoryData = {
  items: IV4HistoryTx[];
  lastCleanTime?: number;
};

class V4SimpleDbEntityHistory extends V4SimpleDbEntityBase<IV4SimpleDbEntityHistoryData> {
  entityName = 'history';

  // disable full history cache,
  // but add accountHistoryCache instead to save memory
  override enableCache = false;

  async getPendingNonceList(props: {
    accountId: string;
    networkId: string;
  }): Promise<number[]> {
    const { accountId } = props;
    const { items: pendingTx } = await this.getAccountHistory({
      accountId,
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
  }: {
    allData: IV4HistoryTx[];
    accountId: string;
  }) {
    return allData.filter(
      (item) =>
        item.decodedTx.status !== EV4DecodedTxStatus.Removed &&
        item.decodedTx.accountId === accountId,
    );
  }

  accountHistoryCache: {
    accountId?: string;
    networkId?: string;
    items: IV4HistoryTx[];
  } = {
    items: [],
  };

  _isActionIncludesToken(options: {
    historyTx: IV4HistoryTx;
    action: IV4DecodedTxAction;
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
  }): Promise<IV4HistoryTx | undefined> {
    const { accountId, networkId, id } = options;
    let list: IV4HistoryTx[] = [];
    // getAccountHistory() for better performance
    if (accountId && networkId) {
      list = (
        await this.getAccountHistory({
          accountId,
        })
      ).items;
    } else {
      list = (await this.getRawData())?.items || [];
    }
    return list?.find((item) => item.id === id);
  }

  async getAccountHistory(props: {
    accountId: string;
    tokenIdOnNetwork?: string;
    limit?: number;
    isPending?: boolean;
  }): Promise<{ items: IV4HistoryTx[] }> {
    const {
      accountId,
      tokenIdOnNetwork,
      isPending,
      limit = HISTORY_CONSTS.GET_LOCAL_LIMIT,
    } = props;
    let items: IV4HistoryTx[] = [];

    if (
      this.accountHistoryCache.accountId === accountId &&
      this.accountHistoryCache.items &&
      this.accountHistoryCache.items.length
    ) {
      items = this.accountHistoryCache.items;
    } else {
      const allData = (await this.getRawData())?.items || [];
      items = this._getAccountHistoryInList({
        allData,
        accountId,
      });
      this.accountHistoryCache = {
        accountId,
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
        const num1 = a.decodedTx.status === EV4DecodedTxStatus.Pending ? -1 : 1;
        const num2 = b.decodedTx.status === EV4DecodedTxStatus.Pending ? -1 : 1;
        return num1 - num2; // pending to first
        // return num2 - num1; // pending to last
      });

    if (tokenIdOnNetwork || tokenIdOnNetwork === '') {
      items = items.filter(
        (item) =>
          ([] as IV4DecodedTxAction[])
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
        (item) => item.decodedTx.status === EV4DecodedTxStatus.Pending,
      );
    }

    items = items.slice(0, limit);

    return {
      items,
    };
  }

  async saveHistoryTx(items: IV4HistoryTx[]) {
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
      });
      this.accountHistoryCache = {
        accountId,
        networkId,
        items: items0,
      };
    }

    setTimeout(() => {
      void this.cleanHistory();
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

export { V4SimpleDbEntityHistory };
