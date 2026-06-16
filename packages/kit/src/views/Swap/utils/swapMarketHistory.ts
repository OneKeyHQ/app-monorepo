import { filterSwapHistoryPendingList } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isPrivateSendSwapHistoryItem } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

function matchSwapHistoryProtocol({
  item,
  protocol,
}: {
  item: ISwapTxHistory;
  protocol?: EProtocolOfExchange;
}) {
  if (protocol === EProtocolOfExchange.STOCK) {
    return item.protocol === EProtocolOfExchange.STOCK;
  }
  return (
    item.protocol !== EProtocolOfExchange.STOCK &&
    item.protocol !== EProtocolOfExchange.LIMIT
  );
}

function getSwapMarketPendingHistoryList(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
  protocol?: EProtocolOfExchange,
) {
  return filterSwapHistoryPendingList(swapHistoryPendingList).filter(
    (item) =>
      !isPrivateSendSwapHistoryItem(item) &&
      matchSwapHistoryProtocol({ item, protocol }) &&
      (item.status === ESwapTxHistoryStatus.PENDING ||
        item.status === ESwapTxHistoryStatus.CANCELING),
  );
}

export function getSwapMarketPendingHistoryCount(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
  protocol?: EProtocolOfExchange,
) {
  return getSwapMarketPendingHistoryList(swapHistoryPendingList, protocol)
    .length;
}

export function getSwapMarketPendingHistoryKey(
  swapHistoryPendingList: (ISwapTxHistory | null | undefined)[],
  protocol?: EProtocolOfExchange,
) {
  return getSwapMarketPendingHistoryList(swapHistoryPendingList, protocol)
    .map((item) => {
      const id = item.txInfo.useOrderId
        ? (item.txInfo.orderId ?? '')
        : (item.txInfo.txId ?? '');
      return `${id}:${item.status}`;
    })
    .join('|');
}
