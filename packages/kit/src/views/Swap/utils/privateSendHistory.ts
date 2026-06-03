import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { isPrivateSendSwapHistoryItem } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
  privateSendFallbackOrderIdPrefix,
  privateSendHelpCenterUrl,
  privateSendProvider,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchSwapTxHistoryStatusResponse,
  ISwapNetwork,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

type IPrivateSendHistoryNavigation = {
  pushModal: (
    route: EModalRoutes.SwapModal,
    params: {
      screen: EModalSwapRoutes.SwapHistoryDetail;
      params: IModalSwapParamList[EModalSwapRoutes.SwapHistoryDetail];
    },
  ) => void;
};

type IPrivateSendHistoryNetwork = {
  id?: string;
  networkId?: string;
  name?: string;
  symbol?: string;
  logoURI?: string;
};

type IPrivateSendTxStateCtx = {
  rocketXOrderId?: unknown;
};

export function isPrivateSendHistoryTx(historyTx: IAccountHistoryTx) {
  return (
    historyTx.decodedTx.payload?.type === EOnChainHistoryTxType.PrivateSend
  );
}

function getPrivateSendHistoryPayload(historyTx: IAccountHistoryTx) {
  return historyTx.decodedTx.payload?.privateSend;
}

function getPrivateSendFallbackOrderId(historyTx: IAccountHistoryTx) {
  return `${privateSendFallbackOrderIdPrefix}${
    historyTx.decodedTx.txid || historyTx.id
  }`;
}

function isPrivateSendFallbackOrderId(orderId?: string) {
  return orderId?.startsWith(privateSendFallbackOrderIdPrefix) ?? false;
}

function ensurePrivateSendHistoryOrderId(item: ISwapTxHistory) {
  const orderId =
    item.swapInfo.orderId ??
    item.txInfo.orderId ??
    item.txInfo.txId ??
    `${item.date.created}`;
  return {
    ...item,
    swapInfo: {
      ...item.swapInfo,
      orderId,
    },
  };
}

function getPrivateSendRocketXOrderIdFromCtx(ctx: unknown) {
  const rocketXOrderId = (ctx as IPrivateSendTxStateCtx | undefined)
    ?.rocketXOrderId;
  return typeof rocketXOrderId === 'string' && rocketXOrderId
    ? rocketXOrderId
    : undefined;
}

function getPrivateSendFallbackStatus(historyTx: IAccountHistoryTx) {
  if (
    historyTx.decodedTx.status === EDecodedTxStatus.Failed ||
    historyTx.decodedTx.status === EDecodedTxStatus.Dropped ||
    historyTx.decodedTx.status === EDecodedTxStatus.Removed
  ) {
    return ESwapTxHistoryStatus.FAILED;
  }
  return ESwapTxHistoryStatus.PENDING;
}

function buildSwapNetwork({
  network,
  fallbackNetworkId,
}: {
  network?: IPrivateSendHistoryNetwork;
  fallbackNetworkId: string;
}): ISwapNetwork {
  return {
    networkId: network?.networkId ?? network?.id ?? fallbackNetworkId,
    name: network?.name ?? '',
    symbol: network?.symbol ?? '',
    logoURI: network?.logoURI,
  };
}

function isPrivateSendHistoryNetworkIncomplete(
  network?: IPrivateSendHistoryNetwork,
) {
  return !network?.name || !network?.symbol || !network?.logoURI;
}

function getPrivateSendHistoryTransfer(historyTx: IAccountHistoryTx) {
  const transferAction = historyTx.decodedTx.actions.find(
    (action) =>
      action.assetTransfer?.sends?.[0] || action.assetTransfer?.receives?.[0],
  );
  return (
    transferAction?.assetTransfer?.sends?.[0] ??
    transferAction?.assetTransfer?.receives?.[0]
  );
}

function buildSwapToken({
  historyTx,
  tokenInfo,
}: {
  historyTx: IAccountHistoryTx;
  tokenInfo?: IToken;
}): ISwapToken {
  const transfer = getPrivateSendHistoryTransfer(historyTx);
  return {
    networkId: historyTx.decodedTx.networkId,
    contractAddress:
      tokenInfo?.address ??
      transfer?.tokenIdOnNetwork ??
      historyTx.decodedTx.tokenIdOnNetwork ??
      '',
    isNative: tokenInfo?.isNative ?? transfer?.isNative,
    symbol: tokenInfo?.symbol ?? transfer?.symbol ?? '',
    decimals: tokenInfo?.decimals ?? 0,
    name: tokenInfo?.name ?? transfer?.name ?? '',
    logoURI: tokenInfo?.logoURI ?? transfer?.icon,
    price: transfer?.price ?? '0',
  };
}

function buildPrivateSendHistoryItemFromAccountHistory({
  historyTx,
  accountId,
  accountAddress,
  network,
  tokenInfo,
  currencySymbol,
}: {
  historyTx: IAccountHistoryTx;
  accountId: string;
  accountAddress?: string;
  network?: IPrivateSendHistoryNetwork;
  tokenInfo?: IToken;
  currencySymbol?: string;
}): ISwapTxHistory {
  const transferAction = historyTx.decodedTx.actions.find(
    (action) =>
      action.assetTransfer?.sends?.[0] || action.assetTransfer?.receives?.[0],
  );
  const transfer =
    transferAction?.assetTransfer?.sends?.[0] ??
    transferAction?.assetTransfer?.receives?.[0];
  const sender =
    transfer?.from ??
    historyTx.decodedTx.signer ??
    accountAddress ??
    historyTx.decodedTx.owner;
  const privateSendPayload = getPrivateSendHistoryPayload(historyTx);
  const receiver = privateSendPayload?.originalRecipient ?? '';
  const token = buildSwapToken({ historyTx, tokenInfo });
  const networkInfo = buildSwapNetwork({
    network,
    fallbackNetworkId: historyTx.decodedTx.networkId,
  });
  const created = historyTx.decodedTx.createdAt ?? Date.now();
  const updated = historyTx.decodedTx.updatedAt ?? created;
  const rocketXOrderId = privateSendPayload?.rocketXOrderId;
  const backendOrderId =
    privateSendPayload?.orderId && privateSendPayload.orderId !== rocketXOrderId
      ? privateSendPayload.orderId
      : undefined;
  const orderId = backendOrderId ?? getPrivateSendFallbackOrderId(historyTx);
  const ctx = rocketXOrderId ? { rocketXOrderId } : undefined;

  return {
    protocol: EProtocolOfExchange.PRIVATE_SEND,
    status: getPrivateSendFallbackStatus(historyTx),
    currency: currencySymbol,
    accountInfo: {
      sender: {
        accountId,
        networkId: historyTx.decodedTx.networkId,
      },
      receiver: {
        accountId,
        networkId: historyTx.decodedTx.networkId,
      },
    },
    baseInfo: {
      fromToken: token,
      toToken: token,
      fromAmount: transfer?.amount ?? historyTx.decodedTx.payload?.value ?? '0',
      toAmount: transfer?.amount ?? historyTx.decodedTx.payload?.value ?? '0',
      fromNetwork: networkInfo,
      toNetwork: networkInfo,
    },
    txInfo: {
      txId: historyTx.decodedTx.txid,
      useOrderId: !!backendOrderId,
      orderId: backendOrderId,
      sender,
      receiver,
      gasFeeInNative: historyTx.decodedTx.totalFeeInNative,
      gasFeeFiatValue: historyTx.decodedTx.totalFeeFiatValue,
    },
    swapInfo: {
      provider: {
        provider: privateSendPayload?.provider ?? privateSendProvider,
        providerName: privateSendPayload?.providerName ?? 'Private Send',
        providerLogo: privateSendPayload?.providerLogo,
      },
      instantRate: '0',
      orderId,
      supportUrl: privateSendPayload?.supportUrl ?? privateSendHelpCenterUrl,
    },
    date: {
      created,
      updated,
    },
    ctx,
  };
}

function canFetchPrivateSendTxState(item: ISwapTxHistory) {
  return (
    isPrivateSendSwapHistoryItem(item) &&
    !!getPrivateSendRocketXOrderIdFromCtx(item.ctx) &&
    !!(item.txInfo.txId || item.txInfo.orderId || item.swapInfo.orderId)
  );
}

async function fetchPrivateSendTxState(item: ISwapTxHistory) {
  const orderId = item.swapInfo.orderId ?? item.txInfo.orderId;
  const rocketXOrderId = getPrivateSendRocketXOrderIdFromCtx(item.ctx);
  const shouldUseOrderId =
    !!orderId &&
    !isPrivateSendFallbackOrderId(orderId) &&
    orderId !== rocketXOrderId;

  return backgroundApiProxy.serviceSwap.fetchTxState({
    txId: item.txInfo.txId ?? '',
    provider: item.swapInfo.provider.provider || privateSendProvider,
    protocol: item.protocol ?? EProtocolOfExchange.PRIVATE_SEND,
    networkId: item.baseInfo.fromToken.networkId,
    ctx: item.ctx,
    toTokenAddress: item.baseInfo.toToken.contractAddress,
    receivedAddress: shouldUseOrderId
      ? item.txInfo.receiver || undefined
      : undefined,
    orderId: shouldUseOrderId ? orderId : undefined,
  });
}

function applyPrivateSendTxState({
  item,
  txState,
}: {
  item: ISwapTxHistory;
  txState?: IFetchSwapTxHistoryStatusResponse;
}) {
  if (!txState) {
    return item;
  }

  return {
    ...item,
    status: txState.state ?? item.status,
    extraStatus: txState.extraStatus ?? item.extraStatus,
    crossChainStatus: txState.crossChainStatus ?? item.crossChainStatus,
    stateDetail: txState.stateDetail ?? item.stateDetail,
    swapOrderHash: txState.swapOrderHash ?? item.swapOrderHash,
    baseInfo: {
      ...item.baseInfo,
      toAmount: txState.dealReceiveAmount ?? item.baseInfo.toAmount,
    },
    txInfo: {
      ...item.txInfo,
      txId: txState.txId ?? item.txInfo.txId,
      gasFeeInNative: txState.gasFee ?? item.txInfo.gasFeeInNative,
      gasFeeFiatValue: txState.gasFeeFiatValue ?? item.txInfo.gasFeeFiatValue,
      receiverTransactionId:
        txState.crossChainReceiveTxHash ?? item.txInfo.receiverTransactionId,
    },
    swapInfo: {
      ...item.swapInfo,
      chainFlipExplorerUrl:
        txState.chainFlipExplorerUrl ?? item.swapInfo.chainFlipExplorerUrl,
      surplus: txState.surplus ?? item.swapInfo.surplus,
    },
    date: {
      ...item.date,
      updated: txState.timestamp ?? item.date.updated,
    },
  };
}

export async function maybeOpenPrivateSendHistoryDetail({
  historyTx,
  navigation,
  accountId,
  accountAddress,
  network,
  tokenInfo,
  currencySymbol,
}: {
  historyTx: IAccountHistoryTx;
  navigation: IPrivateSendHistoryNavigation;
  accountId: string;
  accountAddress?: string;
  network?: IPrivateSendHistoryNetwork;
  tokenInfo?: IToken;
  currencySymbol?: string;
}) {
  const txId = historyTx.decodedTx.txid;
  let txHistoryItem: ISwapTxHistory | undefined;
  if (txId) {
    try {
      txHistoryItem = await backgroundApiProxy.serviceSwap.getSwapHistoryByTxId(
        { txId },
      );
    } catch {
      txHistoryItem = undefined;
    }
  }
  if (!isPrivateSendSwapHistoryItem(txHistoryItem)) {
    txHistoryItem = undefined;
  }
  if (!isPrivateSendHistoryTx(historyTx) && !txHistoryItem) return false;

  let resolvedNetwork = network;
  let resolvedTokenInfo = tokenInfo;
  const resolvedNetworkId = resolvedNetwork?.networkId ?? resolvedNetwork?.id;
  if (
    resolvedNetworkId !== historyTx.decodedTx.networkId ||
    isPrivateSendHistoryNetworkIncomplete(resolvedNetwork)
  ) {
    try {
      resolvedNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: historyTx.decodedTx.networkId,
      });
    } catch {
      resolvedNetwork = network;
    }
  }

  const transfer = getPrivateSendHistoryTransfer(historyTx);
  if (
    !resolvedTokenInfo &&
    (transfer?.isNative || !transfer?.tokenIdOnNetwork)
  ) {
    try {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        accountId,
        networkId: historyTx.decodedTx.networkId,
      });
      resolvedTokenInfo = nativeToken ?? tokenInfo;
    } catch {
      resolvedTokenInfo = tokenInfo;
    }
  }

  const shouldPersistFallbackHistory = !txHistoryItem;
  const resolvedTxHistoryItem =
    txHistoryItem ??
    buildPrivateSendHistoryItemFromAccountHistory({
      historyTx,
      accountId,
      accountAddress,
      network: resolvedNetwork,
      tokenInfo: resolvedTokenInfo,
      currencySymbol,
    });

  let txState: IFetchSwapTxHistoryStatusResponse | undefined;
  if (canFetchPrivateSendTxState(resolvedTxHistoryItem)) {
    try {
      txState = await fetchPrivateSendTxState(resolvedTxHistoryItem);
    } catch {
      txState = undefined;
    }
  }

  const nextTxHistoryItem = ensurePrivateSendHistoryOrderId(
    applyPrivateSendTxState({ item: resolvedTxHistoryItem, txState }),
  );
  if (shouldPersistFallbackHistory) {
    await backgroundApiProxy.serviceSwap.addSwapHistoryItem(nextTxHistoryItem);
  }
  const txHistoryOrderId = nextTxHistoryItem.swapInfo.orderId;

  navigation.pushModal(EModalRoutes.SwapModal, {
    screen: EModalSwapRoutes.SwapHistoryDetail,
    params: {
      txHistoryOrderId,
      txHistoryList: [nextTxHistoryItem],
    },
  });

  return true;
}
