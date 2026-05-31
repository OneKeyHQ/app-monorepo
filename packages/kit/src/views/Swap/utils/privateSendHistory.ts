import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
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

export function isPrivateSendHistoryTx(historyTx: IAccountHistoryTx) {
  return (
    historyTx.decodedTx.payload?.type === EOnChainHistoryTxType.PrivateSend
  );
}

function getPrivateSendFallbackOrderId(historyTx: IAccountHistoryTx) {
  return `private-send-${historyTx.decodedTx.txid || historyTx.id}`;
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

function applyPrivateSendTxState({
  item,
  txState,
}: {
  item: ISwapTxHistory;
  txState?: IFetchSwapTxHistoryStatusResponse;
}) {
  if (!txState) return ensurePrivateSendHistoryOrderId(item);

  return ensurePrivateSendHistoryOrderId({
    ...item,
    status: txState.state ?? item.status,
    extraStatus: txState.extraStatus ?? item.extraStatus,
    crossChainStatus: txState.crossChainStatus ?? item.crossChainStatus,
    stateDetail: txState.stateDetail ?? item.stateDetail,
    swapOrderHash: txState.swapOrderHash ?? item.swapOrderHash,
    txInfo: {
      ...item.txInfo,
      txId: txState.txId ?? item.txInfo.txId,
      receiverTransactionId:
        txState.crossChainReceiveTxHash ?? item.txInfo.receiverTransactionId,
      gasFeeInNative: txState.gasFee ?? item.txInfo.gasFeeInNative,
      gasFeeFiatValue: txState.gasFeeFiatValue ?? item.txInfo.gasFeeFiatValue,
    },
    baseInfo: {
      ...item.baseInfo,
      toAmount: txState.dealReceiveAmount ?? item.baseInfo.toAmount,
    },
    swapInfo: {
      ...item.swapInfo,
      chainFlipExplorerUrl:
        txState.chainFlipExplorerUrl ?? item.swapInfo.chainFlipExplorerUrl,
      surplus: txState.surplus ?? item.swapInfo.surplus,
    },
  });
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

function buildSwapToken({
  historyTx,
  tokenInfo,
}: {
  historyTx: IAccountHistoryTx;
  tokenInfo?: IToken;
}): ISwapToken {
  const transferAction = historyTx.decodedTx.actions.find(
    (action) =>
      action.assetTransfer?.sends?.[0] || action.assetTransfer?.receives?.[0],
  );
  const transfer =
    transferAction?.assetTransfer?.sends?.[0] ??
    transferAction?.assetTransfer?.receives?.[0];

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
  const receiver =
    historyTx.decodedTx.to ?? transfer?.to ?? accountAddress ?? '';
  const token = buildSwapToken({ historyTx, tokenInfo });
  const networkInfo = buildSwapNetwork({
    network,
    fallbackNetworkId: historyTx.decodedTx.networkId,
  });
  const created = historyTx.decodedTx.createdAt ?? Date.now();
  const updated = historyTx.decodedTx.updatedAt ?? created;
  const orderId = getPrivateSendFallbackOrderId(historyTx);

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
      sender,
      receiver,
      gasFeeInNative: historyTx.decodedTx.totalFeeInNative,
      gasFeeFiatValue: historyTx.decodedTx.totalFeeFiatValue,
    },
    swapInfo: {
      provider: {
        provider: privateSendProvider,
        providerName: 'Private Send',
      },
      instantRate: '0',
      orderId,
      supportUrl: privateSendHelpCenterUrl,
    },
    date: {
      created,
      updated,
    },
  };
}

async function fetchPrivateSendTxState(item: ISwapTxHistory) {
  return backgroundApiProxy.serviceSwap.fetchTxState({
    txId: item.txInfo.txId,
    provider: item.swapInfo.provider.provider || privateSendProvider,
    protocol: EProtocolOfExchange.PRIVATE_SEND,
    networkId: item.baseInfo.fromToken.networkId,
    ctx: item.ctx,
    toTokenAddress: item.baseInfo.toToken.contractAddress,
    receivedAddress: item.txInfo.receiver,
    orderId: item.swapInfo.orderId,
  });
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
  if (!isPrivateSendHistoryTx(historyTx)) return false;

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
  let resolvedNetwork = network;
  const resolvedNetworkId = resolvedNetwork?.networkId ?? resolvedNetwork?.id;
  if (resolvedNetworkId !== historyTx.decodedTx.networkId) {
    try {
      resolvedNetwork = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: historyTx.decodedTx.networkId,
      });
    } catch {
      resolvedNetwork = network;
    }
  }

  txHistoryItem ??= buildPrivateSendHistoryItemFromAccountHistory({
    historyTx,
    accountId,
    accountAddress,
    network: resolvedNetwork,
    tokenInfo,
    currencySymbol,
  });

  let txState: IFetchSwapTxHistoryStatusResponse | undefined;
  try {
    txState = await fetchPrivateSendTxState(txHistoryItem);
  } catch {
    txState = undefined;
  }

  const nextTxHistoryItem = applyPrivateSendTxState({
    item: txHistoryItem,
    txState,
  });
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
