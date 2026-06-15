import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
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

export function isPrivateSendSwapHistoryItem(
  item?: ISwapTxHistory | null,
): boolean {
  return (
    item?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    item?.swapInfo?.provider?.provider === privateSendProvider
  );
}

export function isSamePrivateSendSwapHistoryItem(
  a?: ISwapTxHistory | null,
  b?: ISwapTxHistory | null,
): boolean {
  if (!isPrivateSendSwapHistoryItem(a) || !isPrivateSendSwapHistoryItem(b)) {
    return false;
  }

  const aIds = new Set(
    [a?.txInfo.txId, a?.txInfo.orderId, a?.swapInfo.orderId].filter(
      (id): id is string => !!id,
    ),
  );
  return [b?.txInfo.txId, b?.txInfo.orderId, b?.swapInfo.orderId].some(
    (id) => !!id && aIds.has(id),
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
  orderDetailTxStatus,
}: {
  historyTx: IAccountHistoryTx;
  swapHistory?: ISwapTxHistory;
  orderDetailTxStatus?: IFetchSwapTxHistoryStatusResponse;
}) {
  if (!isPrivateSendAccountHistoryTx(historyTx)) {
    return undefined;
  }

  if (
    historyTx.decodedTx.status === EDecodedTxStatus.Failed ||
    historyTx.decodedTx.status === EDecodedTxStatus.Dropped ||
    historyTx.decodedTx.status === EDecodedTxStatus.Removed
  ) {
    return historyTx.decodedTx.status;
  }

  const privateSendSwapHistory = isPrivateSendSwapHistoryItem(swapHistory)
    ? swapHistory
    : undefined;
  let privateSendStatusSource:
    | {
        status: ESwapTxHistoryStatus;
        extraStatus?: ESwapExtraStatus;
        crossChainStatus?: ESwapCrossChainStatus;
      }
    | undefined;
  if (orderDetailTxStatus) {
    privateSendStatusSource = {
      status: orderDetailTxStatus.state,
      extraStatus: orderDetailTxStatus.extraStatus,
      crossChainStatus: orderDetailTxStatus.crossChainStatus,
    };
  } else if (privateSendSwapHistory) {
    privateSendStatusSource = {
      status: privateSendSwapHistory.status,
      extraStatus: privateSendSwapHistory.extraStatus,
      crossChainStatus: privateSendSwapHistory.crossChainStatus,
    };
  }

  if (!privateSendStatusSource) {
    return EDecodedTxStatus.Pending;
  }

  if (
    PRIVATE_SEND_SUCCESS_DISPLAY_STATUSES.has(privateSendStatusSource.status)
  ) {
    return EDecodedTxStatus.Confirmed;
  }

  if (
    PRIVATE_SEND_FAILED_DISPLAY_STATUSES.has(privateSendStatusSource.status) ||
    (privateSendStatusSource.extraStatus &&
      PRIVATE_SEND_FAILED_EXTRA_STATUSES.has(
        privateSendStatusSource.extraStatus,
      )) ||
    (privateSendStatusSource.crossChainStatus &&
      PRIVATE_SEND_FAILED_CROSS_CHAIN_STATUSES.has(
        privateSendStatusSource.crossChainStatus,
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
