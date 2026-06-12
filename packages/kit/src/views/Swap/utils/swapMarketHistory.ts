import { filterSwapHistoryPendingList } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isPrivateSendSwapHistoryItem } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

function getSwapMarketPendingHistoryList(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
) {
  return filterSwapHistoryPendingList(swapHistoryPendingList).filter(
    (item) =>
      !isPrivateSendSwapHistoryItem(item) &&
      (item.status === ESwapTxHistoryStatus.PENDING ||
        item.status === ESwapTxHistoryStatus.CANCELING),
  );
}

export function getSwapMarketPendingHistoryCount(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
) {
  return getSwapMarketPendingHistoryList(swapHistoryPendingList).length;
}

export function getSwapMarketPendingHistoryKey(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
) {
  return getSwapMarketPendingHistoryList(swapHistoryPendingList)
    .map((item) => {
      const id = item.txInfo.useOrderId
        ? (item.txInfo.orderId ?? '')
        : (item.txInfo.txId ?? '');
      return `${id}:${item.status}`;
    })
    .join('|');
}
