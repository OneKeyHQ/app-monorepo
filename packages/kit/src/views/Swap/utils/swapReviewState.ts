import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ESwapNetworkFeeLevel,
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export const NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE = 1;

type INativeBtcSwapTokenIdentity = Pick<ISwapToken, 'isNative' | 'networkId'>;

export function isNativeBitcoinMainnetToken(
  token?: INativeBtcSwapTokenIdentity,
) {
  return Boolean(token?.isNative && networkUtils.isBTCMainnet(token.networkId));
}

export function shouldShowNativeBtcLowSlippageWarning({
  fromToken,
  toToken,
  slippage,
  swapType,
}: {
  fromToken?: INativeBtcSwapTokenIdentity;
  toToken?: INativeBtcSwapTokenIdentity;
  slippage?: number;
  swapType?: ESwapTabSwitchType;
}) {
  if (
    swapType !== ESwapTabSwitchType.SWAP &&
    swapType !== ESwapTabSwitchType.BRIDGE
  ) {
    return false;
  }

  const slippageBN = new BigNumber(slippage ?? Number.NaN);
  if (
    !slippageBN.isFinite() ||
    slippageBN.isNegative() ||
    slippageBN.gte(NATIVE_BTC_MIN_SLIPPAGE_PERCENTAGE)
  ) {
    return false;
  }

  return (
    isNativeBitcoinMainnetToken(fromToken) ||
    isNativeBitcoinMainnetToken(toToken)
  );
}

export function calculateMinToAmountBySlippage({
  toTokenAmount,
  toTokenDecimals,
  slippage,
}: {
  toTokenAmount?: string;
  toTokenDecimals?: number;
  slippage: number;
}) {
  const toTokenAmountBN = new BigNumber(toTokenAmount ?? Number.NaN);
  const slippageBN = new BigNumber(slippage);
  if (
    !toTokenAmountBN.isFinite() ||
    toTokenAmountBN.isNegative() ||
    !slippageBN.isFinite() ||
    slippageBN.isNegative() ||
    slippageBN.gte(100)
  ) {
    return undefined;
  }

  const minToAmountBN = toTokenAmountBN
    .multipliedBy(new BigNumber(100).minus(slippageBN))
    .dividedBy(100);
  if (
    typeof toTokenDecimals === 'number' &&
    Number.isInteger(toTokenDecimals) &&
    toTokenDecimals >= 0
  ) {
    return minToAmountBN
      .decimalPlaces(toTokenDecimals, BigNumber.ROUND_DOWN)
      .toFixed();
  }
  return minToAmountBN.toFixed();
}

export type ISwapReviewGasInfoEntry = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
};

export type ISwapReviewState = {
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
};

export function shouldShowSwapReviewToAmountSkeleton({
  swapBuildLoading,
  toTokenAmount,
}: Pick<ISwapPreSwapData, 'swapBuildLoading' | 'toTokenAmount'>) {
  return Boolean(swapBuildLoading && !toTokenAmount);
}

export type ISwapReviewBroadcastResult = {
  txHash?: string;
  orderId?: string;
  gasFeeFiatValue?: string;
  gasFeeInNative?: string;
};

export type ISwapReviewCustomPriorityFee = {
  customValue: string;
};

export type ISwapReviewApproveBroadcastResult = {
  txHash: string;
  amount: string;
};

export type ISwapReviewAdapter = {
  prepareReview: (params?: {
    fromAmount?: string;
    fromToken?: IFetchQuoteResult['fromTokenInfo'];
    toToken?: IFetchQuoteResult['toTokenInfo'];
    isWrap?: boolean;
    quoteResult?: IFetchQuoteResult;
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
  }) => Promise<ISwapReviewState>;
  sendApproveTx: (params: {
    amount: string;
    gasInfos?: ISwapReviewGasInfoEntry[];
    isResetApprove?: boolean;
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    quoteResult: IFetchQuoteResult;
    onBroadcast?: (result: ISwapReviewApproveBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  sendSwapTx: (params?: {
    approvesInfo?: IApproveInfo[];
    gasInfos?: ISwapReviewGasInfoEntry[];
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    onBroadcast?: (result: ISwapReviewBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  sendWrappedTx: (params?: {
    gasInfos?: ISwapReviewGasInfoEntry[];
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    onBroadcast?: (result: ISwapReviewBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  sendSignMessage: (params?: {
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    onBroadcast?: (result: ISwapReviewBroadcastResult) => void;
    onCancel?: () => void;
  }) => Promise<void>;
  buildApproveInfos: (quoteResult?: IFetchQuoteResult) => IApproveInfo[];
};

export enum ESwapReviewApproveTransactionSource {
  None = 'none',
  Swap = 'swap',
  SpeedSwap = 'speedSwap',
}

export function getSwapReviewApproveTransaction({
  source,
  inAppNotificationAtom,
}: {
  source: ESwapReviewApproveTransactionSource;
  inAppNotificationAtom: {
    swapApprovingTransaction?: ISwapApproveTransaction;
    speedSwapApprovingTransaction?: ISwapApproveTransaction;
  };
}) {
  if (source === ESwapReviewApproveTransactionSource.SpeedSwap) {
    return inAppNotificationAtom.speedSwapApprovingTransaction;
  }

  if (source === ESwapReviewApproveTransactionSource.Swap) {
    return inAppNotificationAtom.swapApprovingTransaction;
  }

  return undefined;
}
