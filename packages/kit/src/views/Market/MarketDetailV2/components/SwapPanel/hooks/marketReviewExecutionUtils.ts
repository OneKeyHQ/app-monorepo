import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  type ISwapReviewStepTexts,
  buildSwapReviewState,
} from '@onekeyhq/kit/src/views/Swap/utils/buildSwapReviewState';
import { buildSwapRateDifference } from '@onekeyhq/kit/src/views/Swap/utils/swapRateDifferenceUtils';
import { getSwapExecutionTypeFromQuoteResult } from '@onekeyhq/kit/src/views/Swap/utils/swapTypeUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type {
  IFetchQuoteResult,
  ISwapApproveTransaction,
  ISwapPreSwapData,
  ISwapStep,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapApproveTransactionStatus,
  ESwapStepType,
} from '@onekeyhq/shared/types/swap/types';

import { isEncodedTxMatch } from './marketEncodedTxUtils';

import type { IMarketGasInfoEntry } from './marketDirectSendTx';

function shouldEnableMarketReviewFeeLevel(steps: ISwapStep[]) {
  return steps.some((step) => step.type === ESwapStepType.APPROVE_TX);
}

export function buildMarketReviewState({
  accountId,
  networkId,
  fromToken,
  toToken,
  fromTokenAmount,
  toTokenAmount,
  quoteResult,
  shouldFallback,
  slippage,
  rateDifference,
  texts,
}: {
  accountId?: string;
  networkId?: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  fromTokenAmount?: string;
  toTokenAmount?: string;
  quoteResult?: IFetchQuoteResult;
  shouldFallback?: boolean;
  slippage?: number;
  rateDifference?: ISwapPreSwapData['rateDifference'];
  texts: ISwapReviewStepTexts;
}) {
  const reviewState = buildSwapReviewState({
    accountId,
    networkId,
    // Market preview reuses the Swap interaction only.
    // The old Market execution stays approve -> confirm -> send, no batch shortcut.
    batchApproveAndSwapEnabled: false,
    fromToken,
    toToken,
    fromTokenAmount,
    toTokenAmount,
    quoteResult,
    swapType: getSwapExecutionTypeFromQuoteResult(quoteResult),
    shouldFallback,
    // Old Market tx confirm supported fee editing for wrap/swap,
    // so preview prebuild should stay enabled for every path.
    supportPreBuild: true,
    slippage,
    rateDifference,
    texts,
  });

  if (shouldEnableMarketReviewFeeLevel(reviewState.steps)) {
    reviewState.preSwapData = {
      ...reviewState.preSwapData,
      supportNetworkFeeLevel: true,
    };
  }

  return reviewState;
}

export function buildMarketReviewRateDifference({
  quoteResult,
  swapInfo,
  defaultTokenCurrency,
  currencyMap,
}: {
  quoteResult?: Pick<IFetchQuoteResult, 'instantRate'>;
  swapInfo?: {
    sender?: { token?: Pick<ISwapToken, 'price' | 'currency'> };
    receiver?: { token?: Pick<ISwapToken, 'price' | 'currency'> };
  };
  defaultTokenCurrency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
}): ISwapPreSwapData['rateDifference'] {
  return buildSwapRateDifference({
    fromTokenPrice: swapInfo?.sender?.token?.price,
    toTokenPrice: swapInfo?.receiver?.token?.price,
    fromTokenCurrency: swapInfo?.sender?.token?.currency,
    toTokenCurrency: swapInfo?.receiver?.token?.currency,
    defaultTokenCurrency,
    currencyMap,
    instantRate: quoteResult?.instantRate,
  });
}

export function findMarketTxConfirmFeeInfo({
  gasInfos,
  encodedTx,
}: {
  gasInfos?: IMarketGasInfoEntry[];
  encodedTx?: IEncodedTx;
}): IFeeInfoUnit | undefined {
  if (!gasInfos?.length || !encodedTx) {
    return undefined;
  }

  return gasInfos.find((item) => isEncodedTxMatch(item.encodeTx, encodedTx))
    ?.gasInfo as IFeeInfoUnit | undefined;
}

export function shouldAutoContinueMarketResetApprove({
  approvedSwapInfo,
  isReviewDialogOpen,
}: {
  approvedSwapInfo?: ISwapApproveTransaction;
  isReviewDialogOpen?: boolean;
}) {
  return Boolean(
    !isReviewDialogOpen &&
    approvedSwapInfo?.status === ESwapApproveTransactionStatus.SUCCESS &&
    approvedSwapInfo.resetApproveValue &&
    Number(approvedSwapInfo.resetApproveValue) > 0,
  );
}

export function shouldSkipMarketSignedPrebuild({
  quoteResult,
  approveUnsignedTxCount,
}: {
  quoteResult?: IFetchQuoteResult;
  approveUnsignedTxCount?: number;
}) {
  return Boolean(quoteResult?.swapShouldSignedData && !approveUnsignedTxCount);
}
