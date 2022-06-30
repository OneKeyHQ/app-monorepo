import { uniqBy } from 'lodash';

import {
  IDecodedTxActionType,
  IDecodedTxStatus,
  IHistoryTx,
} from '../../../vaults/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityHistoryData = IHistoryTx[];

class SimpleDbEntityHistory extends SimpleDbEntityBase<ISimpleDbEntityHistoryData> {
  entityName = 'history';

  override enableCache = false;

  // TODO getMaxPendingNonce()

  // TODO cache accountHistory
  async getAccountHistory(props: {
    accountId: string;
    networkId: string;
    tokenIdOnNetwork?: string;
    limit: number;
  }): Promise<{ items: IHistoryTx[] }> {
    const { accountId, networkId, tokenIdOnNetwork, limit = 100 } = props;
    const allData = await this.getRawData();
    if (!allData) {
      return {
        items: [],
      };
    }
    let items = allData.filter(
      (item) =>
        item.status !== IDecodedTxStatus.Removed &&
        item.accountId === accountId &&
        item.networkId === networkId,
    );
    // throw new Error('test');
    items = items.sort(
      (b, a) =>
        (a.decodedTx.updatedAt ?? a.decodedTx.createdAt ?? 0) -
        (b.decodedTx.updatedAt ?? b.decodedTx.createdAt ?? 0),
    );

    if (tokenIdOnNetwork) {
      items = items.filter(
        (item) =>
          item.decodedTx.actions.filter(
            (action) =>
              action.tokenTransfer?.tokenInfo?.tokenIdOnNetwork ===
                tokenIdOnNetwork ||
              action.tokenApprove?.tokenInfo?.tokenIdOnNetwork ===
                tokenIdOnNetwork,
          ).length > 0,
      );
    } else if (tokenIdOnNetwork === '') {
      items = items.filter(
        (item) =>
          item.decodedTx.actions.filter(
            (action) => action.type === IDecodedTxActionType.NATIVE_TRANSFER,
          ).length > 0,
      );
    }

    // TODO sort Pending first
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
    allData = uniqBy([...items, ...allData], (item) => item.id);
    // TODO remove items in same account > 100
    return this.setRawData(allData);
  }
}

export { SimpleDbEntityHistory };
