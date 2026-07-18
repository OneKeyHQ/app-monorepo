import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  type ISwapReviewStepTexts,
  buildSwapReviewState,
} from '@onekeyhq/kit/src/views/Swap/utils/buildSwapReviewState';
import { isSameSwapExecutionAddress } from '@onekeyhq/kit/src/views/Swap/utils/swapExecutionSnapshotGuard';
import { buildSwapRateDifference } from '@onekeyhq/kit/src/views/Swap/utils/swapRateDifferenceUtils';
import { getSwapExecutionTypeFromQuoteResult } from '@onekeyhq/kit/src/views/Swap/utils/swapTypeUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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

export type IMarketReviewExecutionSigner = {
  accountAddress?: string;
  accountId?: string;
  networkId?: string;
};

export type IMarketReviewExecutionSnapshotGuard = {
  accountAddress: string;
  accountId: string;
  networkId: string;
  kind: 'swap' | 'wrap';
};

export function isMarketReviewUserCancelledError(error: unknown) {
  const normalizedError = error as
    | {
        code?: number;
        key?: string;
        message?: string;
      }
    | undefined;
  const message = normalizedError?.message?.toLowerCase() ?? '';

  return (
    normalizedError?.key === 'global.cancel' ||
    normalizedError?.code === 803 ||
    normalizedError?.code === 822 ||
    normalizedError?.code === 4001 ||
    message.includes('user rejected') ||
    message.includes('rejected by user') ||
    message.includes('user denied') ||
    message.includes('denied by user') ||
    message.includes('user cancelled') ||
    message.includes('user canceled') ||
    message.includes('cancelled by user') ||
    message.includes('canceled by user')
  );
}

export function normalizeMarketReviewInternalError({
  error,
  fallbackMessage,
}: {
  error: unknown;
  fallbackMessage: string;
}) {
  if (!(error instanceof Error) || !error.message.startsWith('Market ')) {
    return error;
  }

  const normalizedError = new OneKeyLocalError(fallbackMessage);
  normalizedError.cause = error;
  return normalizedError;
}

export function requireMarketReviewExecutionSnapshot<
  T extends IMarketReviewExecutionSnapshotGuard,
>({
  currentSigner,
  expectedKind,
  snapshot,
}: {
  currentSigner?: IMarketReviewExecutionSigner;
  expectedKind?: IMarketReviewExecutionSnapshotGuard['kind'];
  snapshot?: T;
}) {
  if (!snapshot) {
    throw new OneKeyLocalError('Market review snapshot missing.');
  }

  if (expectedKind && snapshot.kind !== expectedKind) {
    throw new OneKeyLocalError('Market review snapshot type mismatch.');
  }

  const signerMatches = Boolean(
    snapshot.accountAddress &&
    snapshot.accountId &&
    snapshot.networkId &&
    currentSigner?.accountAddress &&
    currentSigner.accountId &&
    currentSigner.networkId &&
    snapshot.accountId === currentSigner.accountId &&
    snapshot.networkId === currentSigner.networkId &&
    isSameSwapExecutionAddress({
      networkId: snapshot.networkId,
      left: snapshot.accountAddress,
      right: currentSigner.accountAddress,
    }),
  );

  if (!signerMatches) {
    throw new OneKeyLocalError(
      'Market signing account changed. Close Review and try again.',
    );
  }

  return snapshot;
}

export function runMarketPostExecutionActionBestEffort({
  action,
  onError,
}: {
  action: () => void;
  onError: (error: unknown) => void;
}) {
  try {
    action();
  } catch (error) {
    try {
      onError(error);
    } catch {
      // Error reporting is also best effort after irreversible execution.
    }
  }
}

export function publishMarketExecutionResultBestEffort<T>({
  result,
  onBroadcast,
  onBroadcastError,
}: {
  result: T;
  onBroadcast?: (result: T) => void;
  onBroadcastError: (error: unknown) => void;
}) {
  runMarketPostExecutionActionBestEffort({
    action: () => onBroadcast?.(result),
    onError: onBroadcastError,
  });
}

export async function settleMarketExecutionWithBestEffortHistory<T>({
  result,
  onBroadcast,
  onBroadcastError,
  persistHistory,
  onHistoryError,
}: {
  result: T;
  onBroadcast?: (result: T) => void;
  onBroadcastError: (error: unknown) => void;
  persistHistory: () => Promise<unknown>;
  onHistoryError: (error: unknown) => void;
}) {
  // The irreversible action already succeeded. Publish that result before any
  // local bookkeeping so a storage failure can never make the review retry it.
  publishMarketExecutionResultBestEffort({
    result,
    onBroadcast,
    onBroadcastError,
  });

  try {
    await persistHistory();
  } catch (error) {
    try {
      onHistoryError(error);
    } catch {
      // Error reporting is also best effort after irreversible execution.
    }
  }
}

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
