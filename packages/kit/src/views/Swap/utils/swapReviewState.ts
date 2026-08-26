import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ESwapNetworkFeeLevel,
  IFetchBuildTxResult,
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapGasInfo,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapStepStatus,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

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
  isSwapPro,
}: {
  fromToken?: INativeBtcSwapTokenIdentity;
  toToken?: INativeBtcSwapTokenIdentity;
  slippage?: number;
  swapType?: ESwapTabSwitchType;
  isSwapPro?: boolean;
}) {
  if (
    isSwapPro ||
    (swapType !== ESwapTabSwitchType.SWAP &&
      swapType !== ESwapTabSwitchType.BRIDGE)
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

export function invalidateSwapReviewForSlippageChange({
  reviewState,
  slippagePercentage,
}: {
  reviewState: ISwapReviewState;
  slippagePercentage: number;
}): ISwapReviewState {
  const nextMinToAmount = calculateMinToAmountBySlippage({
    toTokenAmount: reviewState.preSwapData.toTokenAmount,
    toTokenDecimals: reviewState.preSwapData.toToken?.decimals,
    slippage: slippagePercentage,
  });
  const minToAmount = nextMinToAmount ?? reviewState.preSwapData.minToAmount;

  return {
    ...reviewState,
    quoteResult: reviewState.quoteResult
      ? {
          ...reviewState.quoteResult,
          slippage: slippagePercentage,
          minToAmount,
          quoteResultCtx: buildCustomSlippageQuoteResultCtx(
            reviewState.quoteResult.quoteResultCtx,
          ),
        }
      : reviewState.quoteResult,
    preSwapData: {
      ...reviewState.preSwapData,
      slippage: slippagePercentage,
      minToAmount,
      swapBuildResultData: undefined,
      netWorkFee: undefined,
      supportNetworkFeeLevel: false,
      estimateNetworkFeeLoading: false,
      requiresSlippageRebuildOnConfirm: true,
    },
  };
}

import type { ESwapReviewRebuildPhase } from './swapReviewRebuildStateMachine';

export type ISwapReviewGasInfoEntry = {
  encodeTx: IEncodedTx;
  gasInfo: ISwapGasInfo;
};

export type ISwapReviewState = {
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
};

const CUSTOM_SLIPPAGE_QUOTE_CONTEXT_KEYS = [
  'okxQuoteResultCtx',
  'oneInchAggregateCtx',
  'zeroXQuoteResultCtx',
  'jupiterQuoteResultCtx',
  'panoraQuoteResultCtx',
  'hifiSwapQuoteResultCtx',
] as const;

export function buildCustomSlippageQuoteResultCtx(quoteResultCtx: unknown) {
  if (!quoteResultCtx || typeof quoteResultCtx !== 'object') {
    return quoteResultCtx;
  }

  const nextQuoteResultCtx = {
    ...(quoteResultCtx as Record<string, unknown>),
  };
  CUSTOM_SLIPPAGE_QUOTE_CONTEXT_KEYS.forEach((key) => {
    const providerContext = nextQuoteResultCtx[key];
    if (providerContext && typeof providerContext === 'object') {
      nextQuoteResultCtx[key] = {
        ...(providerContext as Record<string, unknown>),
        slippageType: 'Custom',
      };
    }
  });

  return nextQuoteResultCtx;
}

export function buildRebuiltSwapReviewQuoteResult({
  quoteResult,
  buildResult,
  slippagePercentage,
}: {
  quoteResult: IFetchQuoteResult;
  buildResult: IFetchBuildTxResult;
  slippagePercentage: number;
}): IFetchQuoteResult {
  return {
    ...quoteResult,
    ...buildResult,
    fromTokenInfo: quoteResult.fromTokenInfo,
    toTokenInfo: quoteResult.toTokenInfo,
    allowanceResult: quoteResult.allowanceResult,
    quoteResultCtx: quoteResult.quoteResultCtx,
    slippage: slippagePercentage,
  };
}

export function resolveSwapReviewNeedFetchGasAfterRebuild({
  fallbackToSeparateTxConfirm,
  previousNeedFetchGas,
}: {
  fallbackToSeparateTxConfirm: boolean;
  previousNeedFetchGas?: boolean;
}) {
  return fallbackToSeparateTxConfirm || Boolean(previousNeedFetchGas);
}

export function hasInFlightSwapReviewSteps({ steps }: { steps: ISwapStep[] }) {
  return steps.some(
    (step) =>
      step.status === ESwapStepStatus.LOADING ||
      step.status === ESwapStepStatus.PENDING,
  );
}

export function shouldCloseSwapReviewOnFocusLoss({
  isFocused,
  isAppLocked,
  hasInFlightSteps,
  initialRootRouterCount,
  currentRootRouterCount,
}: {
  isFocused: boolean;
  isAppLocked: boolean;
  hasInFlightSteps: boolean;
  initialRootRouterCount: number;
  currentRootRouterCount: number;
}) {
  if (isFocused || isAppLocked || hasInFlightSteps) {
    return false;
  }

  return currentRootRouterCount <= initialRootRouterCount;
}

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
  rebuildReview?: (params: {
    slippagePercentage: number;
    networkFeeLevel?: ESwapNetworkFeeLevel;
    customPriorityFee?: ISwapReviewCustomPriorityFee;
    isCurrent: () => boolean;
    onPhaseChange: (
      phase:
        | ESwapReviewRebuildPhase.BuildingTransaction
        | ESwapReviewRebuildPhase.PreparingExecution,
    ) => void;
    onExecutionReady: (reviewState: ISwapReviewState) => void;
  }) => Promise<ISwapReviewState>;
  saveSlippageForFutureOrders?: (
    slippagePercentage: number,
  ) => Promise<void> | void;
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
