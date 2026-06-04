import BigNumber from 'bignumber.js';

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
import type {
  IFetchTokenDetailItem,
  IToken,
} from '@onekeyhq/shared/types/token';
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
  payinAddress?: unknown;
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

function getPrivateSendPayinAddressFromCtx(ctx: unknown) {
  const payinAddress = (ctx as IPrivateSendTxStateCtx | undefined)
    ?.payinAddress;
  return typeof payinAddress === 'string' && payinAddress
    ? payinAddress
    : undefined;
}

function getPrivateSendTxStateReceivedAddress(item: ISwapTxHistory) {
  return getPrivateSendPayinAddressFromCtx(item.ctx) ?? item.txInfo.receiver;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mergePrivateSendHistoryReplayFields({
  item,
  replayItem,
}: {
  item: ISwapTxHistory;
  replayItem: ISwapTxHistory;
}) {
  const replayRocketXOrderId = getPrivateSendRocketXOrderIdFromCtx(
    replayItem.ctx,
  );
  const replayPayinAddress = getPrivateSendPayinAddressFromCtx(replayItem.ctx);
  const currentRocketXOrderId = getPrivateSendRocketXOrderIdFromCtx(item.ctx);
  const currentPayinAddress = getPrivateSendPayinAddressFromCtx(item.ctx);

  let updated = false;
  let nextItem = item;

  if (
    (replayRocketXOrderId && !currentRocketXOrderId) ||
    (replayPayinAddress && !currentPayinAddress)
  ) {
    nextItem = {
      ...nextItem,
      ctx: {
        ...(isRecord(nextItem.ctx) ? nextItem.ctx : {}),
        ...(replayRocketXOrderId && !currentRocketXOrderId
          ? { rocketXOrderId: replayRocketXOrderId }
          : {}),
        ...(replayPayinAddress && !currentPayinAddress
          ? { payinAddress: replayPayinAddress }
          : {}),
      },
    };
    updated = true;
  }

  if (!nextItem.txInfo.receiver && replayItem.txInfo.receiver) {
    nextItem = {
      ...nextItem,
      txInfo: {
        ...nextItem.txInfo,
        receiver: replayItem.txInfo.receiver,
      },
    };
    updated = true;
  }

  return { item: nextItem, updated };
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

function getPositivePriceValue(value?: number | string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const valueBN = new BigNumber(value);
  if (valueBN.isNaN() || !valueBN.isGreaterThan(0)) {
    return undefined;
  }

  return valueBN.toFixed();
}

async function fetchPrivateSendHistoryTokenDetails({
  historyTx,
  accountId,
}: {
  historyTx: IAccountHistoryTx;
  accountId: string;
}) {
  const transfer = getPrivateSendHistoryTransfer(historyTx);
  let tokenAddress =
    transfer?.tokenIdOnNetwork ?? historyTx.decodedTx.tokenIdOnNetwork ?? '';

  if (transfer?.isNative || !tokenAddress) {
    tokenAddress = await backgroundApiProxy.serviceToken.getNativeTokenAddress({
      networkId: historyTx.decodedTx.networkId,
    });
  }

  const tokenDetails = await backgroundApiProxy.serviceToken.fetchTokensDetails(
    {
      accountId,
      networkId: historyTx.decodedTx.networkId,
      contractList: [tokenAddress],
    },
  );

  return tokenDetails?.[0];
}

function buildSwapToken({
  historyTx,
  tokenInfo,
  tokenDetails,
}: {
  historyTx: IAccountHistoryTx;
  tokenInfo?: IToken;
  tokenDetails?: IFetchTokenDetailItem;
}): ISwapToken {
  const transfer = getPrivateSendHistoryTransfer(historyTx);
  const token = tokenDetails?.info ?? tokenInfo;
  const price =
    getPositivePriceValue(transfer?.price) ??
    getPositivePriceValue(tokenDetails?.price);

  return {
    networkId: historyTx.decodedTx.networkId,
    contractAddress:
      token?.address ??
      transfer?.tokenIdOnNetwork ??
      historyTx.decodedTx.tokenIdOnNetwork ??
      '',
    isNative: token?.isNative ?? transfer?.isNative,
    symbol: token?.symbol ?? transfer?.symbol ?? '',
    decimals: token?.decimals ?? 0,
    name: token?.name ?? transfer?.name ?? '',
    logoURI: token?.logoURI ?? transfer?.icon,
    price,
  };
}

function applyPrivateSendTokenDetailsPrice({
  item,
  tokenDetails,
}: {
  item: ISwapTxHistory;
  tokenDetails?: IFetchTokenDetailItem;
}) {
  const price = getPositivePriceValue(tokenDetails?.price);
  if (!price) {
    return { item, updated: false };
  }

  const hasFromTokenPrice = !!getPositivePriceValue(
    item.baseInfo.fromToken.price,
  );
  const hasToTokenPrice = !!getPositivePriceValue(item.baseInfo.toToken.price);
  if (hasFromTokenPrice && hasToTokenPrice) {
    return { item, updated: false };
  }

  return {
    item: {
      ...item,
      baseInfo: {
        ...item.baseInfo,
        fromToken: hasFromTokenPrice
          ? item.baseInfo.fromToken
          : { ...item.baseInfo.fromToken, price },
        toToken: hasToTokenPrice
          ? item.baseInfo.toToken
          : { ...item.baseInfo.toToken, price },
      },
    },
    updated: true,
  };
}

function buildPrivateSendHistoryItemFromAccountHistory({
  historyTx,
  accountId,
  accountAddress,
  network,
  tokenInfo,
  tokenDetails,
  currencySymbol,
}: {
  historyTx: IAccountHistoryTx;
  accountId: string;
  accountAddress?: string;
  network?: IPrivateSendHistoryNetwork;
  tokenInfo?: IToken;
  tokenDetails?: IFetchTokenDetailItem;
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
  const payinAddress = privateSendPayload?.payinAddress ?? transfer?.to;
  const token = buildSwapToken({ historyTx, tokenInfo, tokenDetails });
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
  const ctx =
    rocketXOrderId || payinAddress
      ? {
          ...(rocketXOrderId ? { rocketXOrderId } : {}),
          ...(payinAddress ? { payinAddress } : {}),
        }
      : undefined;

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
    receivedAddress: getPrivateSendTxStateReceivedAddress(item) || undefined,
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
  let resolvedTokenDetails: IFetchTokenDetailItem | undefined;
  try {
    resolvedTokenDetails = await fetchPrivateSendHistoryTokenDetails({
      historyTx,
      accountId,
    });
    resolvedTokenInfo = resolvedTokenInfo ?? resolvedTokenDetails?.info;
  } catch {
    resolvedTokenDetails = undefined;
  }

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
  const replayTxHistoryItem = buildPrivateSendHistoryItemFromAccountHistory({
    historyTx,
    accountId,
    accountAddress,
    network: resolvedNetwork,
    tokenInfo: resolvedTokenInfo,
    tokenDetails: resolvedTokenDetails,
    currencySymbol,
  });
  const { item: baseTxHistoryItem, updated: shouldPersistReplayFields } =
    txHistoryItem
      ? mergePrivateSendHistoryReplayFields({
          item: txHistoryItem,
          replayItem: replayTxHistoryItem,
        })
      : { item: replayTxHistoryItem, updated: false };
  const {
    item: resolvedTxHistoryItem,
    updated: shouldPersistResolvedTokenDetails,
  } = applyPrivateSendTokenDetailsPrice({
    item: baseTxHistoryItem,
    tokenDetails: resolvedTokenDetails,
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
  } else if (shouldPersistResolvedTokenDetails || shouldPersistReplayFields) {
    await backgroundApiProxy.serviceSwap.updateSwapHistoryItem(
      nextTxHistoryItem,
      { shouldShowToast: false },
    );
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
