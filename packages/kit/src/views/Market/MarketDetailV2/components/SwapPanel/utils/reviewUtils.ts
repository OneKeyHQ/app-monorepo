import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EProtocolOfExchange,
  ESwapStepStatus,
  ESwapStepType,
  ESwapTabSwitchType,
  type IFetchQuoteResult,
  type ISwapPreSwapData,
  type ISwapStep,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

type IBuildMarketSwapApproveInfosParams = {
  allowanceResult?: IFetchQuoteResult['allowanceResult'];
  amount: string;
  owner: string;
  fromToken: ISwapToken;
};

type IBuildMarketSwapReviewDataParams = {
  quoteResult: IFetchQuoteResult;
  fromToken: ISwapToken;
  fromTokenAmount: string;
  isHWAndExBatchTransfer?: boolean;
  toToken: ISwapToken;
  slippage: number;
};

type IBuildMarketSwapReviewStateParams = {
  formatMessage: IFormatMessage;
  fromToken: ISwapToken;
  fromTokenAmount: string;
  isHWAndExBatchTransfer?: boolean;
  needFetchGas: boolean;
  quoteResult: IFetchQuoteResult;
  shouldFallback: boolean;
  slippage: number;
  supportPreBuild: boolean;
  swapBatchTransferType: IMarketSwapBatchTransferType;
  toToken: ISwapToken;
};

export const marketSwapBatchTransferTypes = {
  batchApproveAndSwap: 'batch_approve_and_swap',
  continuousApproveAndSwap: 'continuous_approve_and_swap',
  normal: 'normal',
} as const;

export type IMarketSwapBatchTransferType =
  (typeof marketSwapBatchTransferTypes)[keyof typeof marketSwapBatchTransferTypes];

type IFormatMessage = (
  descriptor: {
    id: ETranslations;
  },
  values?: Record<string, string | number>,
) => string;

function buildApproveInfo(params: {
  allowanceTarget: string;
  amount: string;
  fromToken: ISwapToken;
  owner: string;
  isReset?: boolean;
}): IApproveInfo {
  const { allowanceTarget, amount, fromToken, owner, isReset } = params;

  return {
    owner,
    spender: allowanceTarget,
    amount: isReset ? '0' : amount,
    isMax: !isReset,
    tokenInfo: {
      ...fromToken,
      isNative: !!fromToken.isNative,
      address: fromToken.contractAddress,
      name: fromToken.name ?? fromToken.symbol,
    },
  };
}

export function buildMarketSwapApproveInfos({
  allowanceResult,
  amount,
  owner,
  fromToken,
}: IBuildMarketSwapApproveInfosParams): IApproveInfo[] {
  if (!allowanceResult?.allowanceTarget) {
    return [];
  }

  const approveInfos: IApproveInfo[] = [];

  if (allowanceResult.shouldResetApprove) {
    approveInfos.push(
      buildApproveInfo({
        allowanceTarget: allowanceResult.allowanceTarget,
        amount,
        fromToken,
        owner,
        isReset: true,
      }),
    );
  }

  approveInfos.push(
    buildApproveInfo({
      allowanceTarget: allowanceResult.allowanceTarget,
      amount,
      fromToken,
      owner,
    }),
  );

  return approveInfos;
}

function buildMarketSwapReviewData({
  quoteResult,
  fromToken,
  fromTokenAmount,
  isHWAndExBatchTransfer,
  toToken,
  slippage,
}: IBuildMarketSwapReviewDataParams): ISwapPreSwapData {
  return {
    swapType: ESwapTabSwitchType.SWAP,
    fromToken,
    toToken,
    fromTokenAmount: quoteResult.fromAmount ?? fromTokenAmount,
    toTokenAmount: quoteResult.toAmount ?? fromTokenAmount,
    minToAmount: quoteResult.minToAmount,
    providerInfo: quoteResult.info,
    slippage:
      quoteResult.protocol === EProtocolOfExchange.LIMIT ||
      quoteResult.unSupportSlippage
        ? undefined
        : slippage,
    unSupportSlippage: quoteResult.unSupportSlippage ?? false,
    fee: quoteResult.fee,
    isHWAndExBatchTransfer,
  };
}

function createApproveStep(params: {
  formatMessage: IFormatMessage;
  isResetApprove: boolean;
  stepTitle: string;
  stepActionsTranslationId: ETranslations;
}): ISwapStep {
  const { formatMessage, isResetApprove, stepTitle, stepActionsTranslationId } =
    params;

  return {
    type: ESwapStepType.APPROVE_TX,
    status: ESwapStepStatus.READY,
    isResetApprove,
    canRetry: true,
    stepActionsLabel: formatMessage({
      id: stepActionsTranslationId,
    }),
    stepTitle,
    shouldWaitApproved: true,
  };
}

export function buildMarketSwapReviewState({
  formatMessage,
  fromToken,
  fromTokenAmount,
  isHWAndExBatchTransfer,
  needFetchGas,
  quoteResult,
  shouldFallback,
  slippage,
  supportPreBuild,
  swapBatchTransferType,
  toToken,
}: IBuildMarketSwapReviewStateParams): {
  preSwapData: ISwapPreSwapData;
  quoteResult: IFetchQuoteResult;
  steps: ISwapStep[];
} {
  let steps: ISwapStep[] = [];
  const isBatchApproveSwap =
    swapBatchTransferType ===
      marketSwapBatchTransferTypes.batchApproveAndSwap ||
    swapBatchTransferType ===
      marketSwapBatchTransferTypes.continuousApproveAndSwap;

  if (quoteResult.isWrapped) {
    steps = [
      {
        type: ESwapStepType.WRAP_TX,
        status: ESwapStepStatus.READY,
        stepTitle: formatMessage({
          id: ETranslations.swap_page_button_wrap,
        }),
        stepActionsLabel: formatMessage({
          id: ETranslations.swap_page_button_wrap,
        }),
      },
    ];
  } else if (quoteResult.swapShouldSignedData) {
    if (quoteResult.allowanceResult?.shouldResetApprove) {
      steps = [
        createApproveStep({
          formatMessage,
          isResetApprove: true,
          stepTitle: formatMessage(
            {
              id: ETranslations.global_revoke_approve,
            },
            {
              symbol: fromToken.symbol,
            },
          ),
          stepActionsTranslationId: ETranslations.swap_page_approve_and_sign,
        }),
      ];
    }

    if (quoteResult.allowanceResult) {
      steps = [
        ...steps,
        createApproveStep({
          formatMessage,
          isResetApprove: false,
          stepTitle: formatMessage(
            {
              id: ETranslations.swap_page_approve_button,
            },
            {
              token: fromToken.symbol,
            },
          ),
          stepActionsTranslationId: ETranslations.swap_page_approve_and_sign,
        }),
      ];
    }

    steps = [
      ...steps,
      {
        type: ESwapStepType.SIGN_MESSAGE,
        status: ESwapStepStatus.READY,
        stepTitle: formatMessage({
          id: ETranslations.swap_review_sign_and_submit,
        }),
        stepActionsLabel: formatMessage({
          id: ETranslations.global_sign,
        }),
      },
    ];
  } else if (isBatchApproveSwap && quoteResult.allowanceResult) {
    steps = [
      {
        type: ESwapStepType.BATCH_APPROVE_SWAP,
        status: ESwapStepStatus.READY,
        stepTitle:
          swapBatchTransferType ===
          marketSwapBatchTransferTypes.continuousApproveAndSwap
            ? `${formatMessage({
                id: ETranslations.swap_page_approve_and_swap,
              })} [ 0 / ${
                quoteResult.allowanceResult.shouldResetApprove ? 3 : 2
              } ]`
            : formatMessage({
                id: ETranslations.swap_page_approve_and_swap,
              }),
        stepActionsLabel: formatMessage({
          id: ETranslations.swap_page_approve_and_swap,
        }),
      },
    ];
  } else {
    if (quoteResult.allowanceResult?.shouldResetApprove) {
      steps = [
        createApproveStep({
          formatMessage,
          isResetApprove: true,
          stepTitle: formatMessage(
            {
              id: ETranslations.global_revoke_approve,
            },
            {
              symbol: fromToken.symbol,
            },
          ),
          stepActionsTranslationId: ETranslations.swap_page_approve_and_swap,
        }),
      ];
    }

    if (quoteResult.allowanceResult) {
      steps = [
        ...steps,
        createApproveStep({
          formatMessage,
          isResetApprove: false,
          stepTitle: formatMessage(
            {
              id: ETranslations.swap_page_approve_button,
            },
            {
              token: fromToken.symbol,
              target: quoteResult.info.providerName,
            },
          ),
          stepActionsTranslationId: ETranslations.swap_page_approve_and_swap,
        }),
      ];
    }

    steps = [
      ...steps,
      {
        type: ESwapStepType.SEND_TX,
        status: ESwapStepStatus.READY,
        stepTitle: formatMessage({
          id: ETranslations.swap_review_confirm_swap,
        }),
        stepActionsLabel: formatMessage({
          id: ETranslations.global_swap,
        }),
      },
    ];
  }

  return {
    steps,
    preSwapData: {
      ...buildMarketSwapReviewData({
        quoteResult,
        fromToken,
        fromTokenAmount,
        isHWAndExBatchTransfer,
        toToken,
        slippage,
      }),
      shouldFallback,
      supportPreBuild,
      needFetchGas,
      ...(!(
        steps.length > 0 &&
        steps[steps.length - 1].type === ESwapStepType.SIGN_MESSAGE
      )
        ? {
            supportNetworkFeeLevel: true,
          }
        : {}),
    },
    quoteResult: { ...quoteResult },
  };
}

export function createWrappedMarketSwapReviewQuote(params: {
  fromToken: ISwapToken;
  fromTokenAmount: string;
  providerLogo?: string;
  toToken: ISwapToken;
}): IFetchQuoteResult {
  const { fromToken, fromTokenAmount, providerLogo, toToken } = params;

  return {
    protocol: EProtocolOfExchange.SWAP,
    info: {
      provider: 'wrapped',
      providerName: 'wrapped',
      providerLogo,
    },
    isWrapped: true,
    fromAmount: fromTokenAmount,
    toAmount: fromTokenAmount,
    fromTokenInfo: fromToken,
    toTokenInfo: toToken,
    fee: {
      percentageFee: 0,
    },
    unSupportSlippage: true,
  };
}
