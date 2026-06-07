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
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';
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
  privateSendDisplayTransfers?: unknown;
};

type IPrivateSendKnownToken = {
  address?: string;
  contractAddress?: string;
  isNative?: boolean;
};

type IPrivateSendCreateTokenAccountFee = {
  amount?: string;
  symbol?: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPrivateSendDisplayTransfer(
  value: unknown,
): value is IDecodedTxTransferInfo {
  return (
    isRecord(value) &&
    typeof value.amount === 'string' &&
    typeof value.symbol === 'string'
  );
}

function getPrivateSendDisplayTransfersFromCtx(ctx: unknown) {
  const transfers = (ctx as IPrivateSendTxStateCtx | undefined)
    ?.privateSendDisplayTransfers;
  return Array.isArray(transfers)
    ? transfers.filter(isPrivateSendDisplayTransfer)
    : [];
}

function normalizePrivateSendTransferAmount(amount?: string) {
  const amountBN = new BigNumber(amount ?? '');
  return amountBN.isNaN() || !amountBN.isFinite()
    ? (amount ?? '')
    : amountBN.toFixed();
}

function getPrivateSendDisplayTransferIdentity(
  transfer: IDecodedTxTransferInfo,
) {
  return {
    amount: normalizePrivateSendTransferAmount(transfer.amount),
    tokenIdOnNetwork: normalizePrivateSendTokenAddress(
      transfer.tokenIdOnNetwork,
    ),
    symbol: transfer.symbol,
    icon: transfer.icon,
    isNative: transfer.isNative === true,
    price: getPositivePriceValue(transfer.price),
  };
}

function areSamePrivateSendDisplayTransferContents({
  currentIdentity,
  replayIdentity,
}: {
  currentIdentity: ReturnType<typeof getPrivateSendDisplayTransferIdentity>;
  replayIdentity: ReturnType<typeof getPrivateSendDisplayTransferIdentity>;
}) {
  return (
    replayIdentity.amount === currentIdentity.amount &&
    replayIdentity.tokenIdOnNetwork === currentIdentity.tokenIdOnNetwork &&
    replayIdentity.symbol === currentIdentity.symbol &&
    replayIdentity.icon === currentIdentity.icon &&
    replayIdentity.isNative === currentIdentity.isNative
  );
}

function areSamePrivateSendDisplayTransferTokens({
  currentIdentity,
  replayIdentity,
}: {
  currentIdentity: ReturnType<typeof getPrivateSendDisplayTransferIdentity>;
  replayIdentity: ReturnType<typeof getPrivateSendDisplayTransferIdentity>;
}) {
  return (
    replayIdentity.tokenIdOnNetwork === currentIdentity.tokenIdOnNetwork &&
    replayIdentity.symbol === currentIdentity.symbol &&
    replayIdentity.icon === currentIdentity.icon &&
    replayIdentity.isNative === currentIdentity.isNative
  );
}

function findPrivateSendDisplayTransferWithPrice({
  currentTransfers,
  replayTransfer,
  index,
}: {
  currentTransfers: IDecodedTxTransferInfo[];
  replayTransfer: IDecodedTxTransferInfo;
  index: number;
}) {
  const replayIdentity = getPrivateSendDisplayTransferIdentity(replayTransfer);
  const sameIndexTransfer = currentTransfers[index];
  if (sameIndexTransfer) {
    const sameIndexIdentity =
      getPrivateSendDisplayTransferIdentity(sameIndexTransfer);
    if (
      sameIndexIdentity.price &&
      areSamePrivateSendDisplayTransferTokens({
        currentIdentity: sameIndexIdentity,
        replayIdentity,
      })
    ) {
      return sameIndexTransfer;
    }
  }

  return currentTransfers.find((currentTransfer) => {
    const currentIdentity =
      getPrivateSendDisplayTransferIdentity(currentTransfer);
    return (
      currentIdentity.price &&
      areSamePrivateSendDisplayTransferTokens({
        currentIdentity,
        replayIdentity,
      })
    );
  });
}

function mergePrivateSendDisplayTransferPrices({
  currentTransfers,
  replayTransfers,
}: {
  currentTransfers: IDecodedTxTransferInfo[];
  replayTransfers: IDecodedTxTransferInfo[];
}) {
  return replayTransfers.map((replayTransfer, index) => {
    if (getPositivePriceValue(replayTransfer.price)) {
      return replayTransfer;
    }

    const currentTransfer = findPrivateSendDisplayTransferWithPrice({
      currentTransfers,
      replayTransfer,
      index,
    });
    const price = getPositivePriceValue(currentTransfer?.price);
    return price ? { ...replayTransfer, price } : replayTransfer;
  });
}

function areSamePrivateSendDisplayTransfers({
  currentTransfers,
  replayTransfers,
}: {
  currentTransfers: IDecodedTxTransferInfo[];
  replayTransfers: IDecodedTxTransferInfo[];
}) {
  if (currentTransfers.length !== replayTransfers.length) {
    return false;
  }
  return replayTransfers.every((transfer, index) => {
    const replayIdentity = getPrivateSendDisplayTransferIdentity(transfer);
    const currentIdentity = getPrivateSendDisplayTransferIdentity(
      currentTransfers[index],
    );
    return (
      areSamePrivateSendDisplayTransferContents({
        currentIdentity,
        replayIdentity,
      }) &&
      (!replayIdentity.price || replayIdentity.price === currentIdentity.price)
    );
  });
}

function shouldMergePrivateSendDisplayTransfers({
  currentTransfers,
  replayTransfers,
}: {
  currentTransfers: IDecodedTxTransferInfo[];
  replayTransfers: IDecodedTxTransferInfo[];
}) {
  if (!replayTransfers.length) {
    return false;
  }

  return !areSamePrivateSendDisplayTransfers({
    currentTransfers,
    replayTransfers,
  });
}

function shouldMergePrivateSendReplayBaseInfo({
  item,
  replayItem,
}: {
  item: ISwapTxHistory;
  replayItem: ISwapTxHistory;
}) {
  if (
    !isSamePrivateSendSwapToken({
      token1: item.baseInfo.fromToken,
      token2: replayItem.baseInfo.fromToken,
    })
  ) {
    return true;
  }

  return (
    Boolean(replayItem.baseInfo.fromAmount) &&
    !isSamePrivateSendAmount(
      item.baseInfo.fromAmount,
      replayItem.baseInfo.fromAmount,
    )
  );
}

function mergePrivateSendHistoryReplayFields({
  item,
  replayItem,
  shouldMergeReplayBaseInfo,
}: {
  item: ISwapTxHistory;
  replayItem: ISwapTxHistory;
  shouldMergeReplayBaseInfo?: boolean;
}) {
  const replayRocketXOrderId = getPrivateSendRocketXOrderIdFromCtx(
    replayItem.ctx,
  );
  const replayPayinAddress = getPrivateSendPayinAddressFromCtx(replayItem.ctx);
  const currentRocketXOrderId = getPrivateSendRocketXOrderIdFromCtx(item.ctx);
  const currentPayinAddress = getPrivateSendPayinAddressFromCtx(item.ctx);
  const replayDisplayTransfers = getPrivateSendDisplayTransfersFromCtx(
    replayItem.ctx,
  );
  const currentDisplayTransfers = getPrivateSendDisplayTransfersFromCtx(
    item.ctx,
  );
  const shouldMergeDisplayTransfers = shouldMergePrivateSendDisplayTransfers({
    currentTransfers: currentDisplayTransfers,
    replayTransfers: replayDisplayTransfers,
  });
  const mergedReplayDisplayTransfers = shouldMergeDisplayTransfers
    ? mergePrivateSendDisplayTransferPrices({
        currentTransfers: currentDisplayTransfers,
        replayTransfers: replayDisplayTransfers,
      })
    : replayDisplayTransfers;
  const shouldMergeGasFeeInNative = shouldUsePrivateSendReplayFeeValue({
    currentValue: item.txInfo.gasFeeInNative,
    replayValue: replayItem.txInfo.gasFeeInNative,
  });
  const shouldMergeGasFeeFiatValue = shouldUsePrivateSendReplayFeeValue({
    currentValue: item.txInfo.gasFeeFiatValue,
    replayValue: replayItem.txInfo.gasFeeFiatValue,
  });

  let updated = false;
  let nextItem = item;

  if (
    (replayRocketXOrderId && !currentRocketXOrderId) ||
    (replayPayinAddress && !currentPayinAddress) ||
    shouldMergeDisplayTransfers
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
        ...(shouldMergeDisplayTransfers
          ? { privateSendDisplayTransfers: mergedReplayDisplayTransfers }
          : {}),
      },
    };
    updated = true;
  }

  if (shouldMergeGasFeeInNative || shouldMergeGasFeeFiatValue) {
    nextItem = {
      ...nextItem,
      txInfo: {
        ...nextItem.txInfo,
        ...(shouldMergeGasFeeInNative
          ? { gasFeeInNative: replayItem.txInfo.gasFeeInNative }
          : {}),
        ...(shouldMergeGasFeeFiatValue
          ? { gasFeeFiatValue: replayItem.txInfo.gasFeeFiatValue }
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

  if (
    shouldMergeReplayBaseInfo &&
    shouldMergePrivateSendReplayBaseInfo({
      item: nextItem,
      replayItem,
    })
  ) {
    nextItem = {
      ...nextItem,
      baseInfo: replayItem.baseInfo,
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

function getPrivateSendKnownTokenAddress(token?: IPrivateSendKnownToken) {
  return token?.contractAddress ?? token?.address ?? '';
}

function normalizePrivateSendTokenAddress(address?: string) {
  const normalized = address?.trim();
  return normalized ? normalized.toLowerCase() : '';
}

function isSameTokenAddress(a?: string, b?: string) {
  const normalizedA = normalizePrivateSendTokenAddress(a);
  const normalizedB = normalizePrivateSendTokenAddress(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function isSamePrivateSendAddress(a?: string, b?: string) {
  const normalizedA = a?.trim();
  const normalizedB = b?.trim();
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function isSamePrivateSendAmount(a?: string, b?: string) {
  const amountA = new BigNumber(a ?? '');
  const amountB = new BigNumber(b ?? '');
  return !amountA.isNaN() && !amountB.isNaN() && amountA.isEqualTo(amountB);
}

function shouldUsePrivateSendReplayFeeValue({
  currentValue,
  replayValue,
}: {
  currentValue?: string;
  replayValue?: string;
}) {
  const replayValueBN = new BigNumber(replayValue ?? '');
  if (
    replayValueBN.isNaN() ||
    !replayValueBN.isFinite() ||
    !replayValueBN.isGreaterThan(0)
  ) {
    return false;
  }

  const currentValueBN = new BigNumber(currentValue ?? '');
  return (
    currentValueBN.isNaN() ||
    !currentValueBN.isFinite() ||
    !currentValueBN.isGreaterThan(0)
  );
}

function isPrivateSendNativeTokenIdentity({
  tokenInfo,
  transfer,
}: {
  tokenInfo?: IPrivateSendKnownToken;
  transfer: IDecodedTxTransferInfo;
}) {
  const tokenAddress = getPrivateSendKnownTokenAddress(tokenInfo);
  return Boolean(
    (tokenInfo?.isNative || !tokenAddress) &&
    (transfer.isNative || !transfer.tokenIdOnNetwork),
  );
}

function isSamePrivateSendSwapToken({
  token1,
  token2,
}: {
  token1: ISwapToken;
  token2: ISwapToken;
}) {
  if (isSameTokenAddress(token1.contractAddress, token2.contractAddress)) {
    return true;
  }

  return Boolean(
    token1.networkId === token2.networkId &&
    (token1.isNative || !token1.contractAddress) &&
    (token2.isNative || !token2.contractAddress),
  );
}

function getPrivateSendHistoryTransfers(historyTx: IAccountHistoryTx) {
  return historyTx.decodedTx.actions.reduce<IDecodedTxTransferInfo[]>(
    (result, action) => {
      if (action.assetTransfer) {
        result.push(
          ...action.assetTransfer.sends,
          ...action.assetTransfer.receives,
        );
      }
      return result;
    },
    [],
  );
}

function getPrivateSendHistorySendTransfers(historyTx: IAccountHistoryTx) {
  return historyTx.decodedTx.actions.reduce<IDecodedTxTransferInfo[]>(
    (result, action) => {
      if (action.assetTransfer) {
        result.push(...action.assetTransfer.sends);
      }
      return result;
    },
    [],
  );
}

function getPrivateSendCreateTokenAccountFee(historyTx: IAccountHistoryTx) {
  const createTokenAccountFee = (
    historyTx.decodedTx.extraInfo as
      | { createTokenAccountFee?: IPrivateSendCreateTokenAccountFee }
      | null
      | undefined
  )?.createTokenAccountFee;
  const feeAmountBN = new BigNumber(createTokenAccountFee?.amount ?? '');
  if (
    feeAmountBN.isNaN() ||
    !feeAmountBN.isFinite() ||
    !feeAmountBN.isGreaterThan(0)
  ) {
    return undefined;
  }
  return createTokenAccountFee;
}

function hasPrivateSendCreateTokenAccountFeeTransfer({
  transfers,
  createTokenAccountFee,
}: {
  transfers: IDecodedTxTransferInfo[];
  createTokenAccountFee: IPrivateSendCreateTokenAccountFee;
}) {
  return transfers.some(
    (transfer) =>
      transfer.isNative &&
      isSamePrivateSendAmount(transfer.amount, createTokenAccountFee.amount),
  );
}

function buildPrivateSendCreateTokenAccountFeeTransfer({
  historyTx,
  sender,
  network,
  nativeTokenInfo,
  createTokenAccountFee,
  nativeTokenPrice,
}: {
  historyTx: IAccountHistoryTx;
  sender: string;
  network?: IPrivateSendHistoryNetwork;
  nativeTokenInfo?: IToken;
  createTokenAccountFee: IPrivateSendCreateTokenAccountFee;
  nativeTokenPrice?: string;
}): IDecodedTxTransferInfo {
  return {
    from: sender,
    to: '',
    tokenIdOnNetwork: getPrivateSendKnownTokenAddress(nativeTokenInfo),
    icon: nativeTokenInfo?.logoURI ?? network?.logoURI ?? '',
    name:
      nativeTokenInfo?.name ??
      network?.name ??
      createTokenAccountFee.symbol ??
      '',
    symbol:
      nativeTokenInfo?.symbol ??
      createTokenAccountFee.symbol ??
      network?.symbol ??
      '',
    amount: createTokenAccountFee.amount ?? '0',
    isNFT: false,
    isNative: true,
    networkId: historyTx.decodedTx.networkId,
    price: nativeTokenPrice,
  };
}

function buildPrivateSendDisplayTransfers({
  historyTx,
  sender,
  network,
  nativeTokenInfo,
  token,
}: {
  historyTx: IAccountHistoryTx;
  sender: string;
  network?: IPrivateSendHistoryNetwork;
  nativeTokenInfo?: IToken;
  token?: ISwapToken;
}) {
  const sendTransfers = applyPrivateSendDisplayTransferPrice({
    transfers: getPrivateSendHistorySendTransfers(historyTx),
    token,
  });
  const createTokenAccountFee = getPrivateSendCreateTokenAccountFee(historyTx);
  if (!createTokenAccountFee) {
    return sendTransfers;
  }

  if (
    hasPrivateSendCreateTokenAccountFeeTransfer({
      transfers: sendTransfers,
      createTokenAccountFee,
    })
  ) {
    return sendTransfers;
  }

  return [
    ...sendTransfers,
    buildPrivateSendCreateTokenAccountFeeTransfer({
      historyTx,
      sender,
      network,
      nativeTokenInfo,
      createTokenAccountFee,
      nativeTokenPrice: getPrivateSendNativePriceFromFee(historyTx),
    }),
  ];
}

function getPrivateSendHistoryTransfer(
  historyTx: IAccountHistoryTx,
  tokenInfo?: IPrivateSendKnownToken,
) {
  const privateSendPayload = getPrivateSendHistoryPayload(historyTx);
  const sendTransfers = getPrivateSendHistorySendTransfers(historyTx);
  const allTransfers = getPrivateSendHistoryTransfers(historyTx);
  const findTransfer = (
    predicate: (transfer: IDecodedTxTransferInfo) => boolean,
  ) => sendTransfers.find(predicate) ?? allTransfers.find(predicate);

  const payinAddress = privateSendPayload?.payinAddress;
  const payinTransfer = payinAddress
    ? findTransfer((transfer) =>
        isSamePrivateSendAddress(transfer.to, payinAddress),
      )
    : undefined;

  if (payinTransfer) {
    return payinTransfer;
  }

  const tokenAddress = getPrivateSendKnownTokenAddress(tokenInfo);
  const matchedTransfer = tokenAddress
    ? findTransfer((transfer) =>
        isSameTokenAddress(transfer.tokenIdOnNetwork, tokenAddress),
      )
    : undefined;

  if (matchedTransfer) {
    return matchedTransfer;
  }

  const amountTransfer = findTransfer((transfer) =>
    isSamePrivateSendAmount(
      transfer.amount,
      historyTx.decodedTx.payload?.value,
    ),
  );

  if (amountTransfer) {
    return amountTransfer;
  }

  const nativeTransfer = findTransfer((transfer) =>
    isPrivateSendNativeTokenIdentity({
      tokenInfo,
      transfer,
    }),
  );

  return nativeTransfer ?? sendTransfers[0] ?? allTransfers[0];
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

function getPrivateSendNativePriceFromFee(historyTx: IAccountHistoryTx) {
  const totalFeeInNative = getPositivePriceValue(
    historyTx.decodedTx.totalFeeInNative,
  );
  const totalFeeFiatValue = getPositivePriceValue(
    historyTx.decodedTx.totalFeeFiatValue,
  );
  if (!totalFeeInNative || !totalFeeFiatValue) {
    return undefined;
  }

  return new BigNumber(totalFeeFiatValue).div(totalFeeInNative).toFixed();
}

function getPrivateSendDisplayTransferPriceFromToken({
  transfer,
  token,
}: {
  transfer: IDecodedTxTransferInfo;
  token?: ISwapToken;
}) {
  const price = getPositivePriceValue(token?.price);
  if (!price) {
    return undefined;
  }
  if (!token) {
    return undefined;
  }

  if (isSameTokenAddress(transfer.tokenIdOnNetwork, token.contractAddress)) {
    return price;
  }

  if (
    (!transfer.networkId || token.networkId === transfer.networkId) &&
    (token.isNative || !token.contractAddress) &&
    (transfer.isNative || !transfer.tokenIdOnNetwork)
  ) {
    return price;
  }

  return undefined;
}

function applyPrivateSendDisplayTransferPrice({
  transfers,
  token,
}: {
  transfers: IDecodedTxTransferInfo[];
  token?: ISwapToken;
}) {
  return transfers.map((transfer) => {
    if (getPositivePriceValue(transfer.price)) {
      return transfer;
    }

    const price = getPrivateSendDisplayTransferPriceFromToken({
      transfer,
      token,
    });
    return price ? { ...transfer, price } : transfer;
  });
}

async function fetchPrivateSendHistoryTokenDetails({
  historyTx,
  accountId,
  tokenInfo,
}: {
  historyTx: IAccountHistoryTx;
  accountId: string;
  tokenInfo?: IPrivateSendKnownToken;
}) {
  const transfer = getPrivateSendHistoryTransfer(historyTx, tokenInfo);
  let tokenAddress =
    getPrivateSendKnownTokenAddress(tokenInfo) ||
    transfer?.tokenIdOnNetwork ||
    historyTx.decodedTx.tokenIdOnNetwork ||
    '';

  if (
    tokenInfo?.isNative ||
    transfer?.isNative ||
    (transfer ? !transfer.tokenIdOnNetwork : false) ||
    !tokenAddress
  ) {
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
  const transfer = getPrivateSendHistoryTransfer(historyTx, tokenInfo);
  const token = tokenInfo ?? tokenDetails?.info;
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
  nativeTokenInfo,
}: {
  historyTx: IAccountHistoryTx;
  accountId: string;
  accountAddress?: string;
  network?: IPrivateSendHistoryNetwork;
  tokenInfo?: IToken;
  tokenDetails?: IFetchTokenDetailItem;
  currencySymbol?: string;
  nativeTokenInfo?: IToken;
}): ISwapTxHistory {
  const transfer = getPrivateSendHistoryTransfer(historyTx, tokenInfo);
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
  const privateSendDisplayTransfers = buildPrivateSendDisplayTransfers({
    historyTx,
    sender,
    network,
    nativeTokenInfo,
    token,
  });
  const ctx =
    rocketXOrderId || payinAddress || privateSendDisplayTransfers.length
      ? {
          ...(rocketXOrderId ? { rocketXOrderId } : {}),
          ...(payinAddress ? { payinAddress } : {}),
          ...(privateSendDisplayTransfers.length
            ? { privateSendDisplayTransfers }
            : {}),
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

function canFetchPrivateSendOrderDetail(item: ISwapTxHistory) {
  return isPrivateSendSwapHistoryItem(item) && !!item.txInfo.txId;
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

  const knownTokenInfo = resolvedTokenInfo ?? txHistoryItem?.baseInfo.fromToken;
  const transfer = getPrivateSendHistoryTransfer(historyTx, knownTokenInfo);
  let resolvedTokenDetails: IFetchTokenDetailItem | undefined;
  let resolvedNativeTokenInfo: IToken | undefined;
  try {
    resolvedTokenDetails = await fetchPrivateSendHistoryTokenDetails({
      historyTx,
      accountId,
      tokenInfo: knownTokenInfo,
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
  if (getPrivateSendCreateTokenAccountFee(historyTx)) {
    try {
      const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken({
        accountId,
        networkId: historyTx.decodedTx.networkId,
      });
      resolvedNativeTokenInfo = nativeToken ?? undefined;
    } catch {
      resolvedNativeTokenInfo = resolvedTokenInfo?.isNative
        ? resolvedTokenInfo
        : undefined;
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
    nativeTokenInfo: resolvedNativeTokenInfo,
  });
  const { item: baseTxHistoryItem, updated: shouldPersistReplayFields } =
    txHistoryItem
      ? mergePrivateSendHistoryReplayFields({
          item: txHistoryItem,
          replayItem: replayTxHistoryItem,
          shouldMergeReplayBaseInfo: !!resolvedTokenInfo,
        })
      : { item: replayTxHistoryItem, updated: false };
  const {
    item: resolvedTxHistoryItem,
    updated: shouldPersistResolvedTokenDetails,
  } = applyPrivateSendTokenDetailsPrice({
    item: baseTxHistoryItem,
    tokenDetails: resolvedTokenDetails,
  });

  let orderDetailTxHistoryItem = resolvedTxHistoryItem;
  if (canFetchPrivateSendOrderDetail(resolvedTxHistoryItem)) {
    try {
      orderDetailTxHistoryItem =
        await backgroundApiProxy.serviceSwap.fetchPrivateSendOrderDetailHistoryItem(
          { item: resolvedTxHistoryItem },
        );
    } catch {
      orderDetailTxHistoryItem = resolvedTxHistoryItem;
    }
  }
  const shouldPersistOrderDetailFields =
    JSON.stringify(orderDetailTxHistoryItem) !==
    JSON.stringify(resolvedTxHistoryItem);

  const nextTxHistoryItem = ensurePrivateSendHistoryOrderId(
    orderDetailTxHistoryItem,
  );
  if (shouldPersistFallbackHistory) {
    await backgroundApiProxy.serviceSwap.addSwapHistoryItem(nextTxHistoryItem);
  } else if (
    shouldPersistResolvedTokenDetails ||
    shouldPersistReplayFields ||
    shouldPersistOrderDetailFields
  ) {
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
