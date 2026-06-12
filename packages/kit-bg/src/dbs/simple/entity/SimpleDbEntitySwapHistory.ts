import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  isPrivateSendSwapHistoryItem,
  isSamePrivateSendSwapHistoryItem,
  isSwapHistoryProtocolExcluded,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type {
  EProtocolOfExchange,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export const historyCircularBufferMaxSize = 300;

export interface ISwapTxHistoryPersistList {
  histories: ISwapTxHistory[];
}

const SWAP_HISTORY_TERMINAL_STATUSES = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.SUCCESS,
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.PARTIALLY_FILLED,
]);

function isSwapHistoryTerminal(item: ISwapTxHistory) {
  return SWAP_HISTORY_TERMINAL_STATUSES.has(item.status);
}

function isSameSwapHistoryItem(a: ISwapTxHistory, b: ISwapTxHistory) {
  const bPrimaryId = b.txInfo.useOrderId ? b.txInfo.orderId : b.txInfo.txId;
  const aPrimaryId = b.txInfo.useOrderId ? a.txInfo.orderId : a.txInfo.txId;
  if (bPrimaryId && aPrimaryId === bPrimaryId) {
    return true;
  }
  return isSamePrivateSendSwapHistoryItem(a, b);
}

function isSwapHistoryItemMatchedById(item: ISwapTxHistory, id: string) {
  if (!isPrivateSendSwapHistoryItem(item)) {
    return item.txInfo.txId === id;
  }
  return (
    item.txInfo.txId === id ||
    item.txInfo.orderId === id ||
    item.swapInfo.orderId === id
  );
}

function shouldReplaceExistingSwapHistoryItem({
  existing,
  incoming,
}: {
  existing: ISwapTxHistory;
  incoming: ISwapTxHistory;
}) {
  if (!isSamePrivateSendSwapHistoryItem(existing, incoming)) {
    return false;
  }
  const existingTerminal = isSwapHistoryTerminal(existing);
  const incomingTerminal = isSwapHistoryTerminal(incoming);
  if (existingTerminal && !incomingTerminal) {
    return false;
  }
  return incomingTerminal && !existingTerminal;
}

export class SimpleDbEntitySwapHistory extends SimpleDbEntityBase<ISwapTxHistoryPersistList> {
  entityName = 'swapHistory';

  override enableCache = false;

  @backgroundMethod()
  async addSwapHistoryItem(item: ISwapTxHistory) {
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    const existingIndex = histories.findIndex((i) =>
      isSameSwapHistoryItem(i, item),
    );
    if (existingIndex !== -1) {
      if (
        shouldReplaceExistingSwapHistoryItem({
          existing: histories[existingIndex],
          incoming: item,
        })
      ) {
        histories[existingIndex] = item;
        await this.setRawData({ histories });
      }
      return;
    }
    histories.unshift(item);
    if (histories.length > historyCircularBufferMaxSize) {
      histories.pop();
    }
    await this.setRawData({ histories });
  }

  @backgroundMethod()
  async updateSwapHistoryItem(item: ISwapTxHistory, oldTxId?: string) {
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    let index = histories.findIndex((i) => isSameSwapHistoryItem(i, item));
    if (oldTxId) {
      index = histories.findIndex((i) =>
        isSwapHistoryItemMatchedById(i, oldTxId),
      );
    }
    if (index !== -1) {
      histories[index] = item;
      await this.setRawData({ histories });
    }
  }

  @backgroundMethod()
  async deleteSwapHistoryItem(
    statuses?: ESwapTxHistoryStatus[],
    options?: {
      excludeProtocols?: EProtocolOfExchange[];
    },
  ) {
    const shouldKeepHistory = (history: ISwapTxHistory) => {
      if (
        isSwapHistoryProtocolExcluded({
          item: history,
          excludeProtocols: options?.excludeProtocols,
        })
      ) {
        return true;
      }
      return statuses ? !statuses.includes(history.status) : false;
    };
    if (statuses) {
      const data = await this.getRawData();
      const histories = data?.histories ?? [];
      const newHistories = histories.filter(shouldKeepHistory);
      await this.setRawData({ histories: newHistories });
    } else {
      const data = await this.getRawData();
      const histories = data?.histories ?? [];
      await this.setRawData({ histories: histories.filter(shouldKeepHistory) });
    }
  }

  @backgroundMethod()
  async deleteOneSwapHistory(txInfo: {
    txId?: string;
    useOrderId?: boolean;
    orderId?: string;
  }) {
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    const newHistories = histories.filter((i) =>
      txInfo.useOrderId
        ? i.txInfo.orderId !== txInfo.orderId
        : i.txInfo.txId !== txInfo.txId,
    );
    await this.setRawData({ histories: newHistories });
  }

  @backgroundMethod()
  async getSwapHistoryList() {
    const data = await this.getRawData();
    return data?.histories ?? [];
  }

  @backgroundMethod()
  async getSwapHistoryByTxId(txId: string) {
    const data = await this.getRawData();
    return data?.histories?.find((i) => i.txInfo.txId === txId);
  }
}
