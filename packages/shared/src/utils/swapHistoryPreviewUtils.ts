import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

// Terminal (finished) swap-history statuses. Anything not in this set is
// treated as "in-flight" by the preview module (PENDING / CANCELING /
// DEPOSIT_SUCCESS / ...).
export const SWAP_HISTORY_TERMINAL_STATUSES = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.SUCCESS,
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.PARTIALLY_FILLED,
]);

export function isSwapHistoryTerminalStatus(
  status: ESwapTxHistoryStatus,
): boolean {
  return SWAP_HISTORY_TERMINAL_STATUSES.has(status);
}

export type ISwapHistoryPreviewBadgeKind =
  | 'pending'
  | 'failed'
  | 'canceled'
  | 'hold'
  | 'none';

// Which status badge the preview module shows for an item.
// HOLD (needs user attention) -> warning, checked first so a non-terminal status
// doesn't mask it; in-flight -> blue "Pending"; FAILED -> red; CANCELED -> gray;
// SUCCESS / PARTIALLY_FILLED -> no badge.
export function getSwapHistoryPreviewBadgeKind(
  item: ISwapTxHistory,
): ISwapHistoryPreviewBadgeKind {
  if (item.extraStatus === ESwapExtraStatus.HOLD) {
    return 'hold';
  }
  if (!isSwapHistoryTerminalStatus(item.status)) {
    return 'pending';
  }
  if (item.status === ESwapTxHistoryStatus.FAILED) {
    return 'failed';
  }
  if (item.status === ESwapTxHistoryStatus.CANCELED) {
    return 'canceled';
  }
  return 'none';
}

// The items the preview module shows: in-flight items plus unread terminal
// items, ordered purely by submission time (date.created) descending, capped at
// `limit`. Read terminal items are excluded. Pure created-time ordering keeps
// the list stable while the user is viewing it: a finished item does not jump
// position when its status changes, it only swaps its badge.
export function selectSwapHistoryPreviewItems(
  items: ISwapTxHistory[],
  limit = 2,
): ISwapTxHistory[] {
  return items
    .filter(
      (item) =>
        !isSwapHistoryTerminalStatus(item.status) ||
        item.previewReadAt === null ||
        item.previewReadAt === undefined,
    )
    .toSorted((a, b) => b.date.created - a.date.created)
    .slice(0, limit);
}

// Stamp every unread terminal item with `readAt`. In-flight items and
// already-read items are returned unchanged. Pure (returns a new array).
export function markUnreadTerminalAsRead(
  items: ISwapTxHistory[],
  readAt: number,
): ISwapTxHistory[] {
  return items.map((item) =>
    isSwapHistoryTerminalStatus(item.status) &&
    (item.previewReadAt === null || item.previewReadAt === undefined)
      ? { ...item, previewReadAt: readAt }
      : item,
  );
}
