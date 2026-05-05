import type { IBorrowHistory } from '@onekeyhq/shared/types/staking';

type IBorrowHistoryListItem = IBorrowHistory['list'][number];

export function buildBorrowHistoryListItemKey(item: IBorrowHistoryListItem) {
  return [
    item.networkId,
    item.txHash,
    item.type,
    item.tokenAddress,
    item.direction,
    item.amount,
    item.timestamp,
    item.title,
  ].join(':');
}
