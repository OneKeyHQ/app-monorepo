import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export const historyCircularBufferMaxSize = 30;

export interface ISwapTxHistoryPersistList {
  histories: ISwapTxHistory[];
}

export class SimpleDbEntitySwapHistory extends SimpleDbEntityBase<ISwapTxHistoryPersistList> {
  entityName = 'swapHistory';

  override enableCache = false;

  @backgroundMethod()
  async addSwapHistoryItem(item: ISwapTxHistory) {
    const data = await this.getRawData();
    if (data?.histories?.find((i) => i.txInfo.txId === item.txInfo.txId)) {
      return;
    }
    const histories = [item, ...(data?.histories ?? [])];
    if (histories.length > historyCircularBufferMaxSize) {
      histories.pop();
    }
    await this.setRawData({ histories });
  }

  @backgroundMethod()
  async updateSwapHistoryItem(item: ISwapTxHistory, oldTxId?: string) {
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    let index = histories.findIndex((i) => i.txInfo.txId === item.txInfo.txId);
    if (oldTxId) {
      index = histories.findIndex((i) => i.txInfo.txId === oldTxId);
    }
    if (index !== -1) {
      histories[index] = item;
      await this.setRawData({ histories });
    }
  }

  @backgroundMethod()
  async getSwapHistoryList() {
    const data = await this.getRawData();
    return data?.histories ?? [];
  }
}
