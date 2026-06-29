import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  isSwapHistoryTerminalStatus,
  markUnreadTerminalAsRead,
} from '@onekeyhq/shared/src/utils/swapHistoryPreviewUtils';
import {
  isPrivateSendSwapHistoryItem,
  isSamePrivateSendSwapHistoryItem,
  isStockSwapHistoryItem,
  isSwapHistoryProtocolExcluded,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export const historyCircularBufferMaxSize = 300;

export interface ISwapTxHistoryPersistList {
  histories: ISwapTxHistory[];
  previewReadSeeded?: boolean;
}

function isSwapHistoryTerminal(item: ISwapTxHistory) {
  return isSwapHistoryTerminalStatus(item.status);
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
        await this.setRawData({ ...data, histories });
      }
      return;
    }
    histories.unshift(item);
    if (histories.length > historyCircularBufferMaxSize) {
      histories.pop();
    }
    await this.setRawData({ ...data, histories });
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
      await this.setRawData({ ...data, histories });
    }
  }

  @backgroundMethod()
  async deleteSwapHistoryItem(
    statuses?: ESwapTxHistoryStatus[],
    options?: {
      excludeProtocols?: EProtocolOfExchange[];
      // Keep stock trades. The Swap/Bridge list hides stock via the token-level
      // isStock flag, so clearing it must use the same rule (protocol exclusion
      // alone would delete stock orders the user can't see on that tab).
      excludeStock?: boolean;
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
      if (options?.excludeStock && isStockSwapHistoryItem(history)) {
        return true;
      }
      return statuses ? !statuses.includes(history.status) : false;
    };
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    await this.setRawData({
      ...data,
      histories: histories.filter(shouldKeepHistory),
    });
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
    await this.setRawData({ ...data, histories: newHistories });
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

  @backgroundMethod()
  async markUnreadTerminalPreviewRead(readAt: number) {
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    const next = markUnreadTerminalAsRead(histories, readAt);
    await this.setRawData({ ...data, histories: next });
  }

  @backgroundMethod()
  // Returns true only when it actually seeded this call, so the caller can run
  // the invalidation path (re-derive the pending atom) just once.
  async seedPreviewReadIfNeeded(readAt: number): Promise<boolean> {
    const data = await this.getRawData();
    if (data?.previewReadSeeded) {
      return false;
    }
    const histories = data?.histories ?? [];
    const next = markUnreadTerminalAsRead(histories, readAt);
    await this.setRawData({
      ...data,
      histories: next,
      previewReadSeeded: true,
    });
    return true;
  }
}
