import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { normalizeSwapHistoryNetworkInfo } from '@onekeyhq/shared/src/utils/swapHistoryNetworkUtils';
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
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export const historyCircularBufferMaxSize = 300;

export interface ISwapTxHistoryPersistList {
  histories: ISwapTxHistory[];
  /** Durable outbox between broadcast publication and the history commit. */
  pendingWrites?: ISwapTxHistory[];
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

function findSwapHistoryItemIndex(
  histories: ISwapTxHistory[],
  item: ISwapTxHistory,
  oldTxId?: string,
) {
  if (oldTxId) {
    return histories.findIndex((history) =>
      isSwapHistoryItemMatchedById(history, oldTxId),
    );
  }
  return histories.findIndex((history) => isSameSwapHistoryItem(history, item));
}

function addSwapHistoryToList(
  histories: ISwapTxHistory[],
  item: ISwapTxHistory,
) {
  const next = [...histories];
  const existingIndex = findSwapHistoryItemIndex(next, item);
  if (existingIndex !== -1) {
    if (
      shouldReplaceExistingSwapHistoryItem({
        existing: next[existingIndex],
        incoming: item,
      })
    ) {
      next[existingIndex] = item;
    }
    return next;
  }
  next.unshift(item);
  return next.slice(0, historyCircularBufferMaxSize);
}

export class SimpleDbEntitySwapHistory extends SimpleDbEntityBase<ISwapTxHistoryPersistList> {
  entityName = 'swapHistory';

  override enableCache = false;

  @backgroundMethod()
  async stagePendingSwapHistoryItem(item: ISwapTxHistory) {
    await this.setRawData((currentData) => {
      const histories = currentData?.histories ?? [];
      const pendingWrites = (currentData?.pendingWrites ?? []).filter(
        (history) => !isSameSwapHistoryItem(history, item),
      );
      if (!histories.some((history) => isSameSwapHistoryItem(history, item))) {
        pendingWrites.unshift(item);
      }
      return {
        ...currentData,
        histories,
        pendingWrites: pendingWrites.slice(0, historyCircularBufferMaxSize),
      };
    });
  }

  @backgroundMethod()
  async commitPendingSwapHistoryItem(item: ISwapTxHistory) {
    await this.setRawData((currentData) => {
      const pendingWrites = currentData?.pendingWrites ?? [];
      if (findSwapHistoryItemIndex(pendingWrites, item) === -1) {
        return currentData ?? { histories: [] };
      }
      return {
        ...currentData,
        histories: addSwapHistoryToList(currentData?.histories ?? [], item),
        pendingWrites: pendingWrites.filter(
          (history) => !isSameSwapHistoryItem(history, item),
        ),
      };
    });
  }

  @backgroundMethod()
  async recoverPendingSwapHistoryItems() {
    const snapshot = await this.getRawData();
    if (!snapshot?.pendingWrites?.length) {
      return 0;
    }
    let recoveredCount = 0;
    await this.setRawData((currentData) => {
      const pendingWrites = currentData?.pendingWrites ?? [];
      let histories = currentData?.histories ?? [];
      [...pendingWrites].toReversed().forEach((item) => {
        histories = addSwapHistoryToList(histories, item);
      });
      recoveredCount = pendingWrites.length;
      return {
        ...currentData,
        histories,
        pendingWrites: [],
      };
    });
    return recoveredCount;
  }

  @backgroundMethod()
  async addSwapHistoryItem(item: ISwapTxHistory) {
    await this.setRawData((currentData) => ({
      ...currentData,
      histories: addSwapHistoryToList(currentData?.histories ?? [], item),
    }));
  }

  @backgroundMethod()
  async updateSwapHistoryItem(item: ISwapTxHistory, oldTxId?: string) {
    const snapshot = await this.getRawData();
    const snapshotHistories = snapshot?.histories ?? [];
    const snapshotPendingWrites = snapshot?.pendingWrites ?? [];
    if (
      findSwapHistoryItemIndex(snapshotHistories, item, oldTxId) === -1 &&
      findSwapHistoryItemIndex(snapshotPendingWrites, item, oldTxId) === -1
    ) {
      return;
    }

    await this.setRawData((currentData) => {
      let histories = [...(currentData?.histories ?? [])];
      const pendingWrites = [...(currentData?.pendingWrites ?? [])];
      const historyIndex = findSwapHistoryItemIndex(histories, item, oldTxId);
      const pendingIndex = findSwapHistoryItemIndex(
        pendingWrites,
        item,
        oldTxId,
      );
      if (historyIndex !== -1) {
        histories[historyIndex] = item;
      } else if (pendingIndex !== -1) {
        histories = addSwapHistoryToList(histories, item);
      }
      if (pendingIndex !== -1) {
        pendingWrites.splice(pendingIndex, 1);
      }
      return {
        ...currentData,
        histories,
        pendingWrites,
      };
    });
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
      // Mirror of excludeStock for the Stock history surface: only clear stock
      // trades, keeping everything the Swap/Bridge list owns.
      onlyStock?: boolean;
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
      if (options?.onlyStock && !isStockSwapHistoryItem(history)) {
        return true;
      }
      return statuses ? !statuses.includes(history.status) : false;
    };
    await this.setRawData((currentData) => ({
      ...currentData,
      histories: (currentData?.histories ?? []).filter(shouldKeepHistory),
      pendingWrites: (currentData?.pendingWrites ?? []).filter(
        shouldKeepHistory,
      ),
    }));
  }

  @backgroundMethod()
  async deleteOneSwapHistory(txInfo: {
    txId?: string;
    useOrderId?: boolean;
    orderId?: string;
  }) {
    const shouldKeepHistory = (item: ISwapTxHistory) =>
      txInfo.useOrderId
        ? item.txInfo.orderId !== txInfo.orderId
        : item.txInfo.txId !== txInfo.txId;
    await this.setRawData((currentData) => ({
      ...currentData,
      histories: (currentData?.histories ?? []).filter(shouldKeepHistory),
      pendingWrites: (currentData?.pendingWrites ?? []).filter(
        shouldKeepHistory,
      ),
    }));
  }

  @backgroundMethod()
  async repairSwapHistoryNetworkInfo(networks: IServerNetwork[]) {
    const data = await this.getRawData();
    const histories = data?.histories ?? [];
    const preview = normalizeSwapHistoryNetworkInfo({ histories, networks });
    if (!preview.changed) {
      return { histories, changed: false };
    }

    let changed = false;
    const repairedData = await this.setRawData((currentData) => {
      const currentHistories = currentData?.histories ?? [];
      const repaired = normalizeSwapHistoryNetworkInfo({
        histories: currentHistories,
        networks,
      });
      changed = repaired.changed;
      return repaired.changed
        ? { ...currentData, histories: repaired.histories }
        : (currentData ?? { histories: [] });
    });
    return { histories: repairedData?.histories ?? [], changed };
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
    await this.setRawData((currentData) => ({
      ...currentData,
      histories: markUnreadTerminalAsRead(currentData?.histories ?? [], readAt),
    }));
  }

  @backgroundMethod()
  // Returns true only when it actually seeded this call, so the caller can run
  // the invalidation path (re-derive the pending atom) just once.
  async seedPreviewReadIfNeeded(readAt: number): Promise<boolean> {
    const snapshot = await this.getRawData();
    if (snapshot?.previewReadSeeded) {
      return false;
    }
    let seeded = false;
    await this.setRawData((currentData) => {
      if (currentData?.previewReadSeeded) {
        return currentData;
      }
      seeded = true;
      return {
        ...currentData,
        histories: markUnreadTerminalAsRead(
          currentData?.histories ?? [],
          readAt,
        ),
        previewReadSeeded: true,
      };
    });
    return seeded;
  }
}
