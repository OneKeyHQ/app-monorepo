import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapCrossChainStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

const DUAL_TRANSACTION_ID_PROVIDERS = new Set(['SwapHifiSwap', 'SwapHoudi']);

const SECOND_TRANSACTION_ID_HIDDEN_STATUSES = new Set([
  ESwapTxHistoryStatus.FAILED,
  ESwapTxHistoryStatus.CANCELED,
  ESwapTxHistoryStatus.CANCELING,
]);

const REFUND_CROSS_CHAIN_STATUSES = new Set<ESwapCrossChainStatus>([
  ESwapCrossChainStatus.REFUNDING,
  ESwapCrossChainStatus.REFUNDED,
  ESwapCrossChainStatus.REFUND_FAILED,
]);

export function isSwapHistoryRefundStatus(
  crossChainStatus?: ESwapCrossChainStatus,
) {
  return Boolean(
    crossChainStatus && REFUND_CROSS_CHAIN_STATUSES.has(crossChainStatus),
  );
}

export type ISwapHistoryTransactionIdKind =
  | 'transaction'
  | 'sent'
  | 'received'
  | 'source'
  | 'target'
  | 'refund';

export type ISwapHistoryTransactionIdRow = {
  kind: ISwapHistoryTransactionIdKind;
  networkId?: string;
  transactionId?: string;
  showExplorer: boolean;
  showPendingNote?: boolean;
};

function getTransactionId(value?: string) {
  return value || undefined;
}

function getNetworkIds(item: ISwapTxHistory) {
  return {
    fromNetworkId:
      item.baseInfo.fromNetwork?.networkId ?? item.baseInfo.fromToken.networkId,
    toNetworkId:
      item.baseInfo.toNetwork?.networkId ?? item.baseInfo.toToken.networkId,
  };
}

function buildSingleTransactionIdRow({
  transactionId,
  networkId,
  showExplorer,
}: {
  transactionId?: string;
  networkId?: string;
  showExplorer: boolean;
}): ISwapHistoryTransactionIdRow[] {
  return transactionId
    ? [
        {
          kind: 'transaction',
          transactionId,
          networkId,
          showExplorer,
        },
      ]
    : [];
}

export function getSwapHistoryTransactionIdRows(
  item: ISwapTxHistory,
): ISwapHistoryTransactionIdRow[] {
  const { fromNetworkId, toNetworkId } = getNetworkIds(item);
  const sourceTransactionId =
    getTransactionId(item.swapOrderHash?.fromTxHash) ??
    getTransactionId(item.txInfo.txId);
  const targetTransactionId =
    getTransactionId(item.swapOrderHash?.toTxHash) ??
    getTransactionId(item.txInfo.receiverTransactionId);
  const refundTransactionId = getTransactionId(item.swapOrderHash?.refundHash);
  const shouldShowRefundTransaction = Boolean(
    refundTransactionId && isSwapHistoryRefundStatus(item.crossChainStatus),
  );

  const isStandardSwapHistory =
    !item.protocol || item.protocol === EProtocolOfExchange.SWAP;
  const isPrivateSendHistory =
    item.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    item.swapInfo.provider.provider === privateSendProvider;

  if (!isStandardSwapHistory || isPrivateSendHistory) {
    return buildSingleTransactionIdRow({
      transactionId: sourceTransactionId ?? targetTransactionId,
      networkId: sourceTransactionId ? fromNetworkId : toNetworkId,
      showExplorer: false,
    });
  }

  if (!sourceTransactionId) {
    return buildSingleTransactionIdRow({
      transactionId:
        targetTransactionId ??
        (shouldShowRefundTransaction ? refundTransactionId : undefined),
      networkId: targetTransactionId ? toNetworkId : fromNetworkId,
      showExplorer: true,
    });
  }

  const isCrossChain =
    Boolean(fromNetworkId) &&
    Boolean(toNetworkId) &&
    fromNetworkId !== toNetworkId;
  const isKnownDualTransactionIdProvider = DUAL_TRANSACTION_ID_PROVIDERS.has(
    item.swapInfo.provider.provider,
  );
  const shouldUseDualTransactionIdLayout =
    isCrossChain ||
    isKnownDualTransactionIdProvider ||
    Boolean(targetTransactionId) ||
    shouldShowRefundTransaction;

  if (!shouldUseDualTransactionIdLayout) {
    // Same-chain single-hash swaps link to the explorer from the hash row,
    // matching the cross-chain layout; the modal then hides the explorer
    // entry next to the order status automatically.
    return buildSingleTransactionIdRow({
      transactionId: sourceTransactionId,
      networkId: fromNetworkId,
      showExplorer: true,
    });
  }

  const sourceRow: ISwapHistoryTransactionIdRow = {
    kind: isCrossChain ? 'source' : 'sent',
    transactionId: sourceTransactionId,
    networkId: fromNetworkId,
    showExplorer: true,
  };

  if (shouldShowRefundTransaction) {
    return [
      sourceRow,
      {
        kind: 'refund',
        transactionId: refundTransactionId,
        networkId: fromNetworkId,
        showExplorer: true,
      },
    ];
  }

  if (SECOND_TRANSACTION_ID_HIDDEN_STATUSES.has(item.status)) {
    return [sourceRow];
  }

  return [
    sourceRow,
    {
      kind: isCrossChain ? 'target' : 'received',
      transactionId: targetTransactionId,
      networkId: toNetworkId,
      showExplorer: Boolean(targetTransactionId),
      showPendingNote: !targetTransactionId,
    },
  ];
}
