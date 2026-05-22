import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  ESwapTabSwitchType,
  IFetchQuoteResult,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapBatchTransferType,
  ESwapStepStatus,
  ESwapStepType,
  SwapBuildUseMultiplePopoversNetworkIds,
} from '@onekeyhq/shared/types/swap/types';

import { buildSwapRateDifference } from './swapRateDifferenceUtils';

export type ISwapReviewStepTexts = {
  wrap: string;
  approveAndSwap: string;
  approveAndSign: string;
  revokeApprove: string;
  approveToken: string;
  approveTokenWithTarget: string;
  signAndSubmit: string;
  sign: string;
  confirmSwap: string;
  swap: string;
};

export type IBuildSwapBatchTransferTypeParams = {
  networkId?: string;
  accountId?: string;
  providerDisableBatchTransfer?: boolean;
  swapShouldSignedData?: boolean;
  needApprove?: boolean;
  batchApproveAndSwapEnabled?: boolean;
};

export function buildSwapBatchTransferType({
  networkId,
  accountId,
  providerDisableBatchTransfer,
  swapShouldSignedData,
  needApprove,
  batchApproveAndSwapEnabled,
}: IBuildSwapBatchTransferTypeParams): ESwapBatchTransferType {
  let type = ESwapBatchTransferType.NORMAL;

  if (batchApproveAndSwapEnabled && needApprove) {
    type = ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP;
  }

  const isExternalAccount = accountUtils.isExternalAccount({
    accountId: accountId ?? '',
  });
  const isHDAccount = accountUtils.isHwOrQrAccount({
    accountId: accountId ?? '',
  });

  if ((isExternalAccount || isHDAccount) && needApprove) {
    type = ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP;
  }

  const isUnsupportedBatchTransferNetwork =
    SwapBuildUseMultiplePopoversNetworkIds.includes(networkId ?? '');

  if (
    providerDisableBatchTransfer ||
    isUnsupportedBatchTransferNetwork ||
    !batchApproveAndSwapEnabled ||
    swapShouldSignedData
  ) {
    type = ESwapBatchTransferType.NORMAL;
  }

  return type;
}

function buildShouldSignEveryTime({
  accountId,
  needApprove,
}: {
  accountId?: string;
  needApprove?: boolean;
}) {
  const isExternalAccount = accountUtils.isExternalAccount({
    accountId: accountId ?? '',
  });
  const isHDAccount = accountUtils.isHwOrQrAccount({
    accountId: accountId ?? '',
  });

  return (isExternalAccount || isHDAccount) && Boolean(needApprove);
}

function createWrapStep(texts: ISwapReviewStepTexts): ISwapStep {
  return {
    type: ESwapStepType.WRAP_TX,
    status: ESwapStepStatus.READY,
    stepTitle: texts.wrap,
    stepActionsLabel: texts.wrap,
  };
}

function createApproveStep({
  isResetApprove,
  stepActionsLabel,
  stepTitle,
}: {
  isResetApprove: boolean;
  stepActionsLabel: string;
  stepTitle: string;
}): ISwapStep {
  return {
    type: ESwapStepType.APPROVE_TX,
    status: ESwapStepStatus.READY,
    isResetApprove,
    canRetry: true,
    stepActionsLabel,
    stepTitle,
    shouldWaitApproved: true,
  };
}

function createSignStep(texts: ISwapReviewStepTexts): ISwapStep {
  return {
    type: ESwapStepType.SIGN_MESSAGE,
    status: ESwapStepStatus.READY,
    stepTitle: texts.signAndSubmit,
    stepActionsLabel: texts.sign,
  };
}

function createBatchApproveSwapStep({
  texts,
  batchTransferType,
  shouldResetApprove,
}: {
  texts: ISwapReviewStepTexts;
  batchTransferType: ESwapBatchTransferType;
  shouldResetApprove?: boolean;
}): ISwapStep {
  return {
    type: ESwapStepType.BATCH_APPROVE_SWAP,
    status: ESwapStepStatus.READY,
    stepTitle:
      batchTransferType === ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP
        ? `${texts.approveAndSwap} [ 0 / ${shouldResetApprove ? 3 : 2} ]`
        : texts.approveAndSwap,
    stepActionsLabel: texts.approveAndSwap,
  };
}

function createSendTxStep(texts: ISwapReviewStepTexts): ISwapStep {
  return {
    type: ESwapStepType.SEND_TX,
    status: ESwapStepStatus.READY,
    stepTitle: texts.confirmSwap,
    stepActionsLabel: texts.swap,
  };
}

export type IBuildSwapReviewStateInput = {
  accountId?: string;
  networkId?: string;
  batchApproveAndSwapEnabled?: boolean;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  quoteResult?: IFetchQuoteResult;
  swapType: ESwapTabSwitchType;
  shouldFallback?: boolean;
  supportPreBuild: boolean;
  slippage?: number;
  rateDifference?: ISwapPreSwapData['rateDifference'];
  texts: ISwapReviewStepTexts;
};

export function buildSwapReviewState({
  accountId,
  networkId,
  batchApproveAndSwapEnabled,
  fromToken,
  toToken,
  fromTokenAmount,
  toTokenAmount,
  quoteResult,
  swapType,
  shouldFallback,
  supportPreBuild,
  slippage,
  rateDifference,
  texts,
}: IBuildSwapReviewStateInput): {
  batchTransferType: ESwapBatchTransferType;
  steps: ISwapStep[];
  preSwapData: ISwapPreSwapData;
  quoteResult?: IFetchQuoteResult;
} {
  const needApprove = Boolean(quoteResult?.allowanceResult);
  const batchTransferType = buildSwapBatchTransferType({
    networkId,
    accountId,
    providerDisableBatchTransfer: quoteResult?.providerDisableBatchTransfer,
    swapShouldSignedData: Boolean(quoteResult?.swapShouldSignedData),
    needApprove,
    batchApproveAndSwapEnabled,
  });
  const shouldSignEveryTime = buildShouldSignEveryTime({
    accountId,
    needApprove,
  });
  const needFetchGas =
    needApprove &&
    !(
      batchTransferType === ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP ||
      batchTransferType === ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP
    );
  const reviewRateDifference =
    rateDifference ??
    buildSwapRateDifference({
      fromTokenPrice: fromToken?.price,
      toTokenPrice: toToken?.price,
      instantRate: quoteResult?.instantRate,
    });

  let steps: ISwapStep[] = [];

  if (quoteResult?.isWrapped) {
    steps = [createWrapStep(texts)];
  } else if (quoteResult?.swapShouldSignedData) {
    if (quoteResult.allowanceResult) {
      if (quoteResult.allowanceResult.shouldResetApprove) {
        steps = [
          createApproveStep({
            isResetApprove: true,
            stepActionsLabel: texts.approveAndSign,
            stepTitle: texts.revokeApprove,
          }),
        ];
      }

      steps = [
        ...steps,
        createApproveStep({
          isResetApprove: false,
          stepActionsLabel: texts.approveAndSign,
          stepTitle: texts.approveToken,
        }),
      ];
    }

    steps = [...steps, createSignStep(texts)];
  } else if (
    (batchTransferType === ESwapBatchTransferType.BATCH_APPROVE_AND_SWAP ||
      batchTransferType ===
        ESwapBatchTransferType.CONTINUOUS_APPROVE_AND_SWAP) &&
    quoteResult?.allowanceResult
  ) {
    steps = [
      createBatchApproveSwapStep({
        texts,
        batchTransferType,
        shouldResetApprove: quoteResult.allowanceResult.shouldResetApprove,
      }),
    ];
  } else {
    if (quoteResult?.allowanceResult) {
      if (quoteResult.allowanceResult.shouldResetApprove) {
        steps = [
          createApproveStep({
            isResetApprove: true,
            stepActionsLabel: texts.approveAndSwap,
            stepTitle: texts.revokeApprove,
          }),
        ];
      }

      steps = [
        ...steps,
        createApproveStep({
          isResetApprove: false,
          stepActionsLabel: texts.approveAndSwap,
          stepTitle: texts.approveTokenWithTarget,
        }),
      ];
    }

    steps = [...steps, createSendTxStep(texts)];
  }

  const preSwapData: ISwapPreSwapData = {
    swapType,
    fromToken,
    toToken,
    shouldFallback,
    fromTokenAmount,
    toTokenAmount,
    providerInfo: quoteResult?.info,
    supportPreBuild,
    needFetchGas,
    minToAmount: quoteResult?.minToAmount,
    slippage:
      quoteResult?.protocol === EProtocolOfExchange.LIMIT ||
      quoteResult?.unSupportSlippage
        ? undefined
        : slippage,
    rateDifference:
      quoteResult?.protocol === EProtocolOfExchange.LIMIT
        ? undefined
        : reviewRateDifference,
    unSupportSlippage: quoteResult?.unSupportSlippage ?? false,
    isHWAndExBatchTransfer: shouldSignEveryTime,
    fee: quoteResult?.fee,
    allowanceResult: quoteResult?.allowanceResult,
    ...(steps.length > 0 &&
    steps[steps.length - 1].type !== ESwapStepType.SIGN_MESSAGE
      ? {
          supportNetworkFeeLevel: true,
        }
      : {}),
  };

  return {
    batchTransferType,
    steps,
    preSwapData,
    quoteResult,
  };
}
