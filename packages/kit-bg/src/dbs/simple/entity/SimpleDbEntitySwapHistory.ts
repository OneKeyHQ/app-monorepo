import { isEqual } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { normalizeSwapHistoryNetworkInfo } from '@onekeyhq/shared/src/utils/swapHistoryNetworkUtils';
import { markUnreadTerminalAsRead } from '@onekeyhq/shared/src/utils/swapHistoryPreviewUtils';
import type { ISwapHistoryClearOptions } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import {
  isPrivateSendSwapHistoryItem,
  isSamePrivateSendSwapHistoryItem,
  isSwapHistoryTerminalStatus,
  shouldDeleteSwapHistoryItem,
} from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import {
  ESwapTxHistoryStatus,
  type ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';

import {
  SimpleDbEntityBase,
  withWebEntityLock,
} from '../base/SimpleDbEntityBase';

export const historyCircularBufferMaxSize = 300;

function boundPendingWrites(items: ISwapTxHistory[]) {
  const failures = items.filter((item) => item.sourceTxFailed).length;
  if (failures > historyCircularBufferMaxSize) {
    throw new OneKeyLocalError('Too many unresolved swap history failures');
  }
  let remaining = historyCircularBufferMaxSize - failures;
  return items.filter((item) => {
    if (item.sourceTxFailed) return true;
    if (remaining <= 0) return false;
    remaining -= 1;
    return true;
  });
}

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

type ISwapHistoryFeeUpdate = Pick<
  ISwapTxHistory['txInfo'],
  'gasFeeInNative' | 'gasFeeFiatValue'
>;

function mergePrivateSendHistoryFees(
  existing: ISwapTxHistory,
  incoming: ISwapTxHistory,
  feeUpdate?: ISwapHistoryFeeUpdate,
): ISwapTxHistory {
  if (
    !isPrivateSendSwapHistoryItem(existing) ||
    !isPrivateSendSwapHistoryItem(incoming) ||
    !incoming.txInfo.txId ||
    incoming.txInfo.txId !== existing.txInfo.txId ||
    incoming.baseInfo.fromToken.networkId !==
      existing.baseInfo.fromToken.networkId
  ) {
    return incoming;
  }
  const sameCurrency =
    (incoming.currencyId ?? incoming.currency) ===
    (existing.currencyId ?? existing.currency);
  // A poll owns only the fees returned by its response, not those captured
  // in its old request snapshot. Merge against the current row atomically.
  const incomingFees = feeUpdate ?? incoming.txInfo;
  return {
    ...incoming,
    txInfo: {
      ...incoming.txInfo,
      gasFeeInNative:
        incomingFees.gasFeeInNative ??
        existing.txInfo.gasFeeInNative ??
        incoming.txInfo.gasFeeInNative,
      gasFeeFiatValue:
        incomingFees.gasFeeFiatValue ??
        (sameCurrency ? existing.txInfo.gasFeeFiatValue : undefined) ??
        incoming.txInfo.gasFeeFiatValue,
    },
  };
}

function hasSameSourceIdentity(first: ISwapTxHistory, second: ISwapTxHistory) {
  return (
    Boolean(first.txInfo.txId) &&
    first.txInfo.txId === second.txInfo.txId &&
    isEqual(first.accountInfo, second.accountInfo) &&
    isEqual(first.baseInfo.fromToken, second.baseInfo.fromToken) &&
    isEqual(first.baseInfo.toToken, second.baseInfo.toToken) &&
    first.txInfo.sender === second.txInfo.sender &&
    first.txInfo.receiver === second.txInfo.receiver
  );
}

function addSwapHistoryToList(
  histories: ISwapTxHistory[],
  item: ISwapTxHistory,
) {
  const next = [...histories];
  const existingIndex = findSwapHistoryItemIndex(next, item);
  if (existingIndex !== -1) {
    const existing = next[existingIndex];
    if (existing.sourceTxFailed) return next;
    if (item.sourceTxFailed) {
      const matches = hasSameSourceIdentity(existing, item);
      if (
        matches &&
        [
          ESwapTxHistoryStatus.PENDING,
          ESwapTxHistoryStatus.FAILED,
          ESwapTxHistoryStatus.CANCELED,
          ESwapTxHistoryStatus.EXPIRED,
          ESwapTxHistoryStatus.REFUNDED,
        ].includes(existing.status)
      ) {
        next[existingIndex] = {
          ...existing,
          sourceTxFailed: true,
          status:
            existing.status === ESwapTxHistoryStatus.PENDING
              ? ESwapTxHistoryStatus.FAILED
              : existing.status,
        };
      }
      return next;
    }
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
  override async getRawData() {
    return withWebEntityLock(this.entityKey, () => super.getRawData());
  }

  @backgroundMethod()
  override async setRawData(
    data: Parameters<
      SimpleDbEntityBase<ISwapTxHistoryPersistList>['setRawData']
    >[0],
  ) {
    return withWebEntityLock(this.entityKey, () => super.setRawData(data));
  }

  @backgroundMethod()
  override async clearRawData() {
    return withWebEntityLock(this.entityKey, () => super.clearRawData());
  }

  @backgroundMethod()
  async stagePendingSwapHistoryItem(item: ISwapTxHistory) {
    await this.setRawData((currentData) => {
      const histories = currentData?.histories ?? [];
      const previousPending = (currentData?.pendingWrites ?? []).find(
        (history) => isSameSwapHistoryItem(history, item),
      );
      const previousHistory = histories.find((history) =>
        isSameSwapHistoryItem(history, item),
      );
      if (previousPending?.sourceTxFailed || previousHistory?.sourceTxFailed)
        return currentData ?? { histories };
      if (item.sourceTxFailed && previousHistory) {
        const merged = addSwapHistoryToList(histories, item);
        if (
          merged.some(
            (history) =>
              isSameSwapHistoryItem(history, item) && history.sourceTxFailed,
          )
        )
          return { ...currentData, histories: merged };
        return {
          ...currentData,
          histories,
          pendingWrites: boundPendingWrites([
            item,
            ...(currentData?.pendingWrites ?? []).filter(
              (history) => !isSameSwapHistoryItem(history, item),
            ),
          ]),
        };
      }
      const pendingWrites = (currentData?.pendingWrites ?? []).filter(
        (history) => !isSameSwapHistoryItem(history, item),
      );
      const alreadyRecorded = histories.some((history) =>
        isSameSwapHistoryItem(history, item),
      );
      if (!alreadyRecorded) {
        pendingWrites.unshift(item);
      }
      const bounded = boundPendingWrites(pendingWrites);
      if (
        !alreadyRecorded &&
        !bounded.some((history) => isSameSwapHistoryItem(history, item))
      ) {
        throw new OneKeyLocalError('Swap history outbox is full');
      }
      return {
        ...currentData,
        histories,
        pendingWrites: bounded,
      };
    });
  }

  @backgroundMethod()
  async commitPendingSwapHistoryItem(item: ISwapTxHistory) {
    await this.setRawData((currentData) => {
      const pendingWrites = currentData?.pendingWrites ?? [];
      const index = findSwapHistoryItemIndex(pendingWrites, item);
      if (index === -1) {
        return currentData ?? { histories: [] };
      }
      const pending = pendingWrites[index];
      const histories = addSwapHistoryToList(
        currentData?.histories ?? [],
        pending,
      );
      if (
        pending.sourceTxFailed &&
        !histories.some(
          (history) =>
            isSameSwapHistoryItem(history, pending) && history.sourceTxFailed,
        )
      )
        return currentData ?? { histories: [] };
      return {
        ...currentData,
        histories,
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
      const unresolved: ISwapTxHistory[] = [];
      [...pendingWrites].toReversed().forEach((item) => {
        const next = addSwapHistoryToList(histories, item);
        if (
          item.sourceTxFailed &&
          !next.some(
            (history) =>
              isSameSwapHistoryItem(history, item) && history.sourceTxFailed,
          )
        )
          unresolved.unshift(item);
        else {
          histories = next;
          recoveredCount += 1;
        }
      });
      return {
        ...currentData,
        histories,
        pendingWrites: unresolved,
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
  async updateSwapHistoryItem(
    item: ISwapTxHistory,
    oldTxId?: string,
    feeUpdate?: ISwapHistoryFeeUpdate,
  ): Promise<ISwapTxHistory | undefined> {
    const snapshot = await this.getRawData();
    const snapshotHistories = snapshot?.histories ?? [];
    const snapshotPendingWrites = snapshot?.pendingWrites ?? [];
    if (
      findSwapHistoryItemIndex(snapshotHistories, item, oldTxId) === -1 &&
      findSwapHistoryItemIndex(snapshotPendingWrites, item, oldTxId) === -1
    ) {
      return;
    }

    let updatedItem: ISwapTxHistory | undefined;
    await this.setRawData((currentData) => {
      let histories = [...(currentData?.histories ?? [])];
      const pendingWrites = [...(currentData?.pendingWrites ?? [])];
      const historyIndex = findSwapHistoryItemIndex(histories, item, oldTxId);
      const pendingIndex = findSwapHistoryItemIndex(
        pendingWrites,
        item,
        oldTxId,
      );
      if (
        historyIndex !== -1 &&
        pendingIndex !== -1 &&
        pendingWrites[pendingIndex].sourceTxFailed
      ) {
        const pending = pendingWrites[pendingIndex];
        const merged = addSwapHistoryToList(histories, pending);
        const preserved = merged.find(
          (history) =>
            isSameSwapHistoryItem(history, pending) && history.sourceTxFailed,
        );
        if (!preserved) {
          if (hasSameSourceIdentity(pending, item)) updatedItem = pending;
          return currentData ?? { histories: [] };
        }
        histories = merged;
        updatedItem = preserved;
        pendingWrites.splice(pendingIndex, 1);
        return { ...currentData, histories, pendingWrites };
      }
      if (historyIndex !== -1) {
        const existing = histories[historyIndex];
        updatedItem = existing.sourceTxFailed
          ? existing
          : mergePrivateSendHistoryFees(existing, item, feeUpdate);
        histories[historyIndex] = updatedItem;
      } else if (pendingIndex !== -1) {
        const existing = pendingWrites[pendingIndex];
        updatedItem = existing.sourceTxFailed
          ? existing
          : mergePrivateSendHistoryFees(existing, item, feeUpdate);
        histories = addSwapHistoryToList(histories, updatedItem);
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
    return updatedItem;
  }

  @backgroundMethod()
  async markEarnSwapSourceFailed(expected: ISwapTxHistory) {
    let result: ISwapTxHistory | undefined;
    const safeStatuses = new Set([
      ESwapTxHistoryStatus.PENDING,
      ESwapTxHistoryStatus.FAILED,
      ESwapTxHistoryStatus.CANCELED,
      ESwapTxHistoryStatus.EXPIRED,
      ESwapTxHistoryStatus.REFUNDED,
    ]);
    await this.setRawData((data) => {
      const candidates = [
        ...(data?.histories ?? []),
        ...(data?.pendingWrites ?? []),
      ].filter((item) => item.txInfo.txId === expected.txInfo.txId);
      if (
        !candidates.length ||
        candidates.some(
          (item) =>
            !safeStatuses.has(item.status) ||
            !isEqual(item.accountInfo, expected.accountInfo) ||
            !isEqual(item.baseInfo.fromToken, expected.baseInfo.fromToken) ||
            !isEqual(item.baseInfo.toToken, expected.baseInfo.toToken) ||
            item.txInfo.sender !== expected.txInfo.sender ||
            item.txInfo.receiver !== expected.txInfo.receiver,
        )
      )
        return data ?? { histories: [] };
      const update = (item: ISwapTxHistory) => {
        if (item.txInfo.txId !== expected.txInfo.txId) return item;
        const next = {
          ...item,
          sourceTxFailed: true as const,
          status:
            item.status === ESwapTxHistoryStatus.PENDING
              ? ESwapTxHistoryStatus.FAILED
              : item.status,
        };
        result = next;
        return next;
      };
      return {
        ...data,
        histories: (data?.histories ?? []).map(update),
        pendingWrites: (data?.pendingWrites ?? []).map(update),
      };
    });
    return result;
  }

  @backgroundMethod()
  async deleteSwapHistoryItem(
    statuses?: ESwapTxHistoryStatus[],
    options?: ISwapHistoryClearOptions,
  ) {
    const shouldKeepHistory = (history: ISwapTxHistory) =>
      !shouldDeleteSwapHistoryItem(history, statuses, options);
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
