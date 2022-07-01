import { uniqBy } from 'lodash';

import { HISTORY_CONSTS } from '../../../constants';
import {
  IDecodedTxAction,
  IDecodedTxStatus,
  IHistoryTx,
} from '../../../vaults/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityHistoryData = IHistoryTx[];

class SimpleDbEntityHistory extends SimpleDbEntityBase<ISimpleDbEntityHistoryData> {
  entityName = 'history';

  // disable full history cache,
  // but add accountHistoryCache instead to save memory
  override enableCache = false;

  async getMaxPendingNonce(props: {
    accountId: string;
    networkId: string;
  }): Promise<number> {
    const { accountId, networkId } = props;
    const { items: pendingTx } = await this.getAccountHistory({
      accountId,
      networkId,
      isPending: true,
    });
    const nonceList = pendingTx.map((item) => item.decodedTx.nonce);
    if (nonceList.length) {
      const nonce = Math.max(...nonceList);
      if (Number.isNaN(nonce) || nonce === Infinity || nonce === -Infinity) {
        return 0;
      }
      return nonce;
    }
    return 0;
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
        item.status !== IDecodedTxStatus.Removed &&
        item.accountId === accountId &&
        item.networkId === networkId,
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

    const { tokenTransfer, tokenApprove, nativeTransfer, internalSwap } =
      action;
    return (
      nativeTransfer?.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      tokenTransfer?.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      tokenApprove?.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      internalSwap?.send.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      internalSwap?.receive.tokenInfo.tokenIdOnNetwork === tokenIdOnNetwork ||
      historyTx.decodedTx?.tokenIdOnNetwork === tokenIdOnNetwork
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
      list = (await this.getRawData()) || [];
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
      const allData = (await this.getRawData()) || [];
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
          item.decodedTx.actions.filter((action) =>
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
    let allData = (await this.getRawData()) || [];

    // TODO uniqBy optimize and keep original order
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

    // TODO auto remove items in same network and account > 100
    return this.setRawData(allData);
  }
}

export { SimpleDbEntityHistory };
