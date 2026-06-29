import BigNumber from 'bignumber.js';

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
  ESwapTabSwitchType,
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

export const SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS = 90 * 60 * 1000;

export type ISwapOrderLongPendingWarningPayload = {
  orderId: string;
  pendingDuration: number;
  swapTxHash: string;
  createdTime: number;
  swapType: ESwapTabSwitchType;
  provider: string;
  fromNetwork: string;
  toNetwork: string;
  fromTokenSymbol: string;
  fromTokenAddress: string;
  fromTokenAmount: string;
  fromTokenFiatValue: string;
  toTokenSymbol: string;
  toTokenAddress: string;
  toTokenAmount: string;
  slippage: string;
  feeFiatValue: string;
  walletType: string;
  protocol: EProtocolOfExchange;
  status: ESwapTxHistoryStatus;
  sourceChain: string;
  receivedChain: string;
  sourceTokenSymbol: string;
  receivedTokenSymbol: string;
  swapProvider: string;
  swapProviderName: string;
  orderType: EProtocolOfExchange;
  quoteToTokenAmount: string;
  router: string;
  feeType: string;
  duration: number;
};

function getSwapHistoryOrderId(item: ISwapTxHistory): string {
  return item.swapInfo.orderId ?? item.txInfo.orderId ?? '';
}

function getSwapHistorySwapType(item: ISwapTxHistory): ESwapTabSwitchType {
  if (item.protocol === EProtocolOfExchange.LIMIT) {
    return ESwapTabSwitchType.LIMIT;
  }
  if (item.protocol === EProtocolOfExchange.PRIVATE_SEND) {
    return ESwapTabSwitchType.PRIVATE_SEND;
  }
  if (item.protocol === EProtocolOfExchange.STOCK) {
    return ESwapTabSwitchType.STOCK;
  }
  const fromNetworkId =
    item.baseInfo.fromNetwork?.networkId ?? item.baseInfo.fromToken.networkId;
  const toNetworkId =
    item.baseInfo.toNetwork?.networkId ?? item.baseInfo.toToken.networkId;
  if (fromNetworkId && toNetworkId && fromNetworkId !== toNetworkId) {
    return ESwapTabSwitchType.BRIDGE;
  }
  return ESwapTabSwitchType.SWAP;
}

function getTokenFiatValue({
  amount,
  fiatValue,
  price,
}: {
  amount: string;
  fiatValue?: string;
  price?: string;
}) {
  const amountBN = new BigNumber(amount);
  const priceBN = new BigNumber(price ?? '');
  if (amountBN.isFinite() && priceBN.isFinite()) {
    return amountBN.multipliedBy(priceBN).toFixed();
  }
  return fiatValue ?? '';
}

function getSwapHistoryFeeType(item: ISwapTxHistory): string {
  return (
    item.swapInfo.oneKeyFee?.toString() ??
    item.swapInfo.protocolFee?.toString() ??
    ''
  );
}

export function buildSwapOrderLongPendingWarningPayload({
  item,
  now = Date.now(),
}: {
  item?: ISwapTxHistory | null;
  now?: number;
}): ISwapOrderLongPendingWarningPayload | undefined {
  if (
    !item ||
    !shouldShowSwapHistoryLongPendingWarning({
      item,
      now,
    })
  ) {
    return undefined;
  }

  const orderId = getSwapHistoryOrderId(item);
  if (!orderId) {
    return undefined;
  }

  const pendingDuration = Math.floor(
    Math.max(now - item.date.created, 0) / 1000,
  );
  const sourceChain =
    item.baseInfo.fromNetwork?.networkId ?? item.baseInfo.fromToken.networkId;
  const receivedChain =
    item.baseInfo.toNetwork?.networkId ?? item.baseInfo.toToken.networkId;
  const swapProvider = item.swapInfo.provider.provider;
  const swapProviderName = item.swapInfo.provider.providerName;
  const protocol = item.protocol ?? EProtocolOfExchange.SWAP;
  const fromTokenAmount = item.baseInfo.fromAmount;
  const toTokenAmount = item.baseInfo.toAmount;

  return {
    orderId,
    pendingDuration,
    swapTxHash: item.txInfo.txId ?? '',
    createdTime: item.date.created,
    swapType: getSwapHistorySwapType(item),
    provider: swapProvider,
    fromNetwork: sourceChain,
    toNetwork: receivedChain,
    fromTokenSymbol: item.baseInfo.fromToken.symbol,
    fromTokenAddress: item.baseInfo.fromToken.contractAddress,
    fromTokenAmount,
    fromTokenFiatValue: getTokenFiatValue({
      amount: fromTokenAmount,
      fiatValue: item.baseInfo.fromToken.fiatValue,
      price: item.baseInfo.fromToken.price,
    }),
    toTokenSymbol: item.baseInfo.toToken.symbol,
    toTokenAddress: item.baseInfo.toToken.contractAddress,
    toTokenAmount,
    slippage: '',
    feeFiatValue: item.txInfo.gasFeeFiatValue ?? '',
    walletType: '',
    protocol,
    status: item.status,
    sourceChain,
    receivedChain,
    sourceTokenSymbol: item.baseInfo.fromToken.symbol,
    receivedTokenSymbol: item.baseInfo.toToken.symbol,
    swapProvider,
    swapProviderName,
    orderType: protocol,
    quoteToTokenAmount: toTokenAmount,
    router: '',
    feeType: getSwapHistoryFeeType(item),
    duration: pendingDuration,
  };
}

export function isPrivateSendSwapHistoryItem(
  item?: ISwapTxHistory | null,
): boolean {
  return (
    item?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    item?.swapInfo?.provider?.provider === privateSendProvider
  );
}

// Whether a history item is a stock trade. The token-level `isStock` flag is the
// authoritative signal (preserved end-to-end when the item is recorded);
// `protocol === STOCK` is only a secondary hint because it is backend-echoed and
// can fall back to SWAP. This is the single source of truth used by both the
// Swap/Stock history list split and the history clear logic, so the two never
// diverge (e.g. clearing the Swap tab must not delete hidden stock history).
export function isStockSwapHistoryItem(item: ISwapTxHistory): boolean {
  return Boolean(
    item.protocol === EProtocolOfExchange.STOCK ||
    item.baseInfo?.fromToken?.isStock ||
    item.baseInfo?.toToken?.isStock,
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

export function getSwapHistoryLongPendingWarningDelayMs({
  item,
  now = Date.now(),
}: {
  item?: ISwapTxHistory | null;
  now?: number;
}): number | undefined {
  if (
    !item ||
    item.status !== ESwapTxHistoryStatus.PENDING ||
    isPrivateSendSwapHistoryItem(item)
  ) {
    return undefined;
  }

  const created = item.date.created;
  if (!Number.isFinite(created) || created <= 0 || !Number.isFinite(now)) {
    return undefined;
  }

  return Math.max(
    created + SWAP_HISTORY_LONG_PENDING_WARNING_THRESHOLD_MS - now,
    0,
  );
}

export function shouldShowSwapHistoryLongPendingWarning({
  item,
  now = Date.now(),
}: {
  item?: ISwapTxHistory | null;
  now?: number;
}): boolean {
  return getSwapHistoryLongPendingWarningDelayMs({ item, now }) === 0;
}
