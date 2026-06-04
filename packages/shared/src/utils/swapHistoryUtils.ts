import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

const PRIVATE_SEND_FAILED_DISPLAY_STATUSES = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
]);

const PRIVATE_SEND_SUCCESS_DISPLAY_STATUSES = new Set<ESwapTxHistoryStatus>([
  ESwapTxHistoryStatus.SUCCESS,
  ESwapTxHistoryStatus.PARTIALLY_FILLED,
]);

const PRIVATE_SEND_FAILED_EXTRA_STATUSES = new Set<ESwapExtraStatus>([
  ESwapExtraStatus.EXPIRED,
  ESwapExtraStatus.REFUNDED,
]);

const PRIVATE_SEND_FAILED_CROSS_CHAIN_STATUSES = new Set<ESwapCrossChainStatus>(
  [
    ESwapCrossChainStatus.EXPIRED,
    ESwapCrossChainStatus.PROVIDER_ERROR,
    ESwapCrossChainStatus.REFUNDED,
    ESwapCrossChainStatus.REFUND_FAILED,
  ],
);

export function isPrivateSendSwapHistoryItem(item?: ISwapTxHistory): boolean {
  return (
    item?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    item?.swapInfo?.provider?.provider === privateSendProvider
  );
}

export function isPrivateSendAccountHistoryTx(
  item?: IAccountHistoryTx,
): boolean {
  return item?.decodedTx?.payload?.type === EOnChainHistoryTxType.PrivateSend;
}

export function getPrivateSendHistoryDisplayStatus({
  historyTx,
  swapHistory,
}: {
  historyTx: IAccountHistoryTx;
  swapHistory?: ISwapTxHistory;
}) {
  if (!isPrivateSendAccountHistoryTx(historyTx)) {
    return undefined;
  }

  if (
    historyTx.decodedTx.status === EDecodedTxStatus.Pending ||
    historyTx.decodedTx.status === EDecodedTxStatus.Failed ||
    historyTx.decodedTx.status === EDecodedTxStatus.Dropped ||
    historyTx.decodedTx.status === EDecodedTxStatus.Removed
  ) {
    return historyTx.decodedTx.status;
  }

  const privateSendSwapHistory = isPrivateSendSwapHistoryItem(swapHistory)
    ? swapHistory
    : undefined;

  if (!privateSendSwapHistory) {
    return EDecodedTxStatus.Pending;
  }

  if (
    PRIVATE_SEND_SUCCESS_DISPLAY_STATUSES.has(privateSendSwapHistory.status)
  ) {
    return EDecodedTxStatus.Confirmed;
  }

  if (
    PRIVATE_SEND_FAILED_DISPLAY_STATUSES.has(privateSendSwapHistory.status) ||
    (privateSendSwapHistory.extraStatus &&
      PRIVATE_SEND_FAILED_EXTRA_STATUSES.has(
        privateSendSwapHistory.extraStatus,
      )) ||
    (privateSendSwapHistory.crossChainStatus &&
      PRIVATE_SEND_FAILED_CROSS_CHAIN_STATUSES.has(
        privateSendSwapHistory.crossChainStatus,
      ))
  ) {
    return EDecodedTxStatus.Failed;
  }

  return EDecodedTxStatus.Pending;
}

export function isSwapHistoryProtocolExcluded({
  item,
  excludeProtocols,
}: {
  item: ISwapTxHistory;
  excludeProtocols?: EProtocolOfExchange[];
}) {
  if (!excludeProtocols?.length) {
    return false;
  }
  if (
    excludeProtocols.includes(EProtocolOfExchange.PRIVATE_SEND) &&
    isPrivateSendSwapHistoryItem(item)
  ) {
    return true;
  }
  return Boolean(item.protocol && excludeProtocols.includes(item.protocol));
}
