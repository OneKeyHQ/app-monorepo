import { unionBy } from 'lodash';

import { getHistoryTxDisplayStatus } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import type { IHomeHistoryStorePayload } from './homeHistorySourceAdapter';

export const HOME_HISTORY_ACTION_IDS = {
  loadMore: 'home.history.loadMore',
  openDetails: 'home.history.openDetails',
  refresh: 'home.history.refresh',
} as const;

export function createHomeHistoryStorePayload({
  addressMap = {},
  cursor = null,
  data = [],
  hasMore = false,
  isLoadingMore = false,
  refresh = 'idle',
  tokenMap = {},
}: Partial<IHomeHistoryStorePayload> = {}): IHomeHistoryStorePayload {
  return {
    addressMap,
    cursor,
    data,
    hasMore,
    isLoadingMore,
    refresh,
    tokenMap,
  };
}

export function selectRecentHomeHistoryRows(
  data: readonly IAccountHistoryTx[],
  limit: number | undefined,
): IAccountHistoryTx[] {
  if (!limit) {
    return [...data];
  }
  const rows: IAccountHistoryTx[] = [];
  let settledCount = 0;
  for (const tx of data) {
    rows.push(tx);
    if (getHistoryTxDisplayStatus(tx) !== EDecodedTxStatus.Pending) {
      settledCount += 1;
    }
    if (settledCount >= limit) {
      break;
    }
  }
  return rows;
}

function isLocalPendingTx(tx: IAccountHistoryTx): boolean {
  const status = tx.displayStatus ?? tx.decodedTx?.status;
  return Boolean(tx.isLocalCreated && status === EDecodedTxStatus.Pending);
}

export function reconcileHomeHistoryFirstPage({
  current,
  firstPage,
  previousFirstPage,
}: {
  current: readonly IAccountHistoryTx[];
  firstPage: readonly IAccountHistoryTx[];
  previousFirstPage: readonly IAccountHistoryTx[];
}): IAccountHistoryTx[] {
  const firstPageIds = new Set(firstPage.map((tx) => tx.id));
  const overlapsPreviousFirstPage = previousFirstPage.some(
    (tx) => !isLocalPendingTx(tx) && firstPageIds.has(tx.id),
  );
  if (
    !overlapsPreviousFirstPage ||
    current.length <= previousFirstPage.length
  ) {
    return [...firstPage];
  }
  const displaced = current.filter(
    (tx) => !firstPageIds.has(tx.id) && !isLocalPendingTx(tx),
  );
  return unionBy([...firstPage, ...displaced], (tx) => tx.id);
}

export function mergeHomeHistoryPage({
  current,
  incoming,
}: {
  current: readonly IAccountHistoryTx[];
  incoming: readonly IAccountHistoryTx[];
}): { data: IAccountHistoryTx[]; addedCount: number } {
  const known = new Set(current.map((tx) => tx.id));
  const added = incoming.filter((tx) => !known.has(tx.id));
  return {
    data: unionBy([...current, ...added], (tx) => tx.id),
    addedCount: added.length,
  };
}

export function mergeHomeHistoryAddressMap(
  current: Record<string, IAddressBadge>,
  incoming: Record<string, IAddressBadge> | undefined,
): Record<string, IAddressBadge> {
  return incoming && Object.keys(incoming).length > 0
    ? { ...current, ...incoming }
    : current;
}
