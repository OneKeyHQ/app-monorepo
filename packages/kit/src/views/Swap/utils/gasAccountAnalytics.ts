import BigNumber from 'bignumber.js';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { getGasAccountErrorCode } from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IGasAccountActionParams,
  IGasAccountAnalyticsContext,
  IGasAccountEntryPoint,
} from '@onekeyhq/shared/src/logger/scopes/transaction/types';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import type {
  IEstimateFeeParams,
  IFeeInfoUnit,
  IGasAccountUiState,
} from '@onekeyhq/shared/types/fee';
import type { ISwapGasInfo } from '@onekeyhq/shared/types/swap/types';

import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntry,
} from '../../SignatureConfirm/constants/gasAccountErrorCodes';
import {
  buildGasAccountAnalyticsContext,
  isGasSponsoredAnalyticsContext,
} from '../../SignatureConfirm/utils/gasAccountAnalytics';

type IDirectSwapGasAccountActionDetails = Omit<
  IGasAccountActionParams,
  keyof IGasAccountAnalyticsContext
>;

export function logDirectSwapGasAccountAction(
  context: IGasAccountAnalyticsContext | undefined,
  details: IDirectSwapGasAccountActionDetails,
) {
  if (!context || !isGasSponsoredAnalyticsContext(context)) {
    return;
  }
  defaultLogger.transaction.send.gasAccountAction({
    ...context,
    ...details,
  });
}

export type IGasAccountReviewSession = {
  analyticsContext?: IGasAccountAnalyticsContext;
  nativeBalance?: string;
  decisionLogged: boolean;
  submitted: boolean;
  exitLogged: boolean;
};

export function createGasAccountReviewSession(): IGasAccountReviewSession {
  return {
    decisionLogged: false,
    submitted: false,
    exitLogged: false,
  };
}

export function markGasAccountReviewSubmitted(
  session: IGasAccountReviewSession | undefined,
) {
  if (!session || session.submitted) {
    return;
  }
  logDirectSwapGasAccountAction(session.analyticsContext, {
    action: 'confirmClicked',
  });
  session.submitted = true;
}

export function logGasAccountReviewExit(
  session: IGasAccountReviewSession | undefined,
) {
  if (!session || session.submitted || session.exitLogged) {
    return;
  }
  session.exitLogged = true;
  logDirectSwapGasAccountAction(session.analyticsContext, {
    action: 'exited',
  });
}

function getNativeOtherFeeAmount({
  networkId,
  unsignedTx,
}: {
  networkId: string;
  unsignedTx: IUnsignedTxPro;
}) {
  return (
    unsignedTx.swapInfo?.swapBuildResData.result?.fee?.otherFeeInfos ?? []
  )
    .filter((item) => item.token.isNative && item.token.networkId === networkId)
    .reduce((total, item) => total.plus(item.amount || 0), new BigNumber(0))
    .toFixed();
}

function getDirectSwapGasAccountUnavailableReason({
  hasEligibleQuote,
  useGasAccountByDefault,
  gasAccountCandidate,
  gasAccountScenarioReason,
}: {
  hasEligibleQuote: boolean;
  useGasAccountByDefault: boolean | undefined;
  gasAccountCandidate: boolean;
  gasAccountScenarioReason: string | undefined;
}) {
  if (hasEligibleQuote) {
    return undefined;
  }
  if (useGasAccountByDefault === false) {
    return 'userDisabled';
  }
  if (gasAccountCandidate) {
    return gasAccountScenarioReason ?? 'backend_unknown';
  }
  return 'swapBuildDisabled';
}

export function buildDirectSwapGasAccountAnalyticsContext({
  entryPoint,
  networkId,
  unsignedTx,
  gasInfo,
  estimateFeeParams,
  txSize,
  nativeBalance,
  useGasAccountByDefault,
  fiatCurrency,
}: {
  entryPoint: Extract<IGasAccountEntryPoint, 'swapDirect' | 'marketSwapDirect'>;
  networkId: string;
  unsignedTx: IUnsignedTxPro;
  gasInfo: ISwapGasInfo;
  estimateFeeParams?: IEstimateFeeParams;
  txSize?: number;
  nativeBalance: string | undefined;
  useGasAccountByDefault: boolean | undefined;
  fiatCurrency: string | undefined;
}): IGasAccountAnalyticsContext | undefined {
  const swapInfo = unsignedTx.swapInfo;
  if (!swapInfo?.sender?.token || !gasInfo.common) {
    return undefined;
  }

  const { originalTotalNative, totalNative } = calculateFeeForSend({
    feeInfo: gasInfo as IFeeInfoUnit,
    nativeTokenPrice: gasInfo.common.nativeTokenPrice ?? 0,
    estimateFeeParams,
    txSize,
  });
  const sender = swapInfo.sender;
  const nativePrincipal =
    sender.token.isNative && sender.token.networkId === networkId
      ? sender.amount
      : '0';
  const hasEligibleQuote = Boolean(
    gasInfo.gasAccountEligible && gasInfo.gasAccountQuote?.quoteId,
  );
  const gasAccountCandidate = Boolean(
    swapInfo.swapBuildResData.result?.gasAccountEnabled,
  );
  const gasAccountRequested =
    gasAccountCandidate && useGasAccountByDefault !== false;
  const selectedPayer =
    hasEligibleQuote && gasInfo.payer === 'gasAccount' ? 'gasAccount' : 'user';
  let gasAccountSupported: boolean | null = null;
  if (hasEligibleQuote) {
    gasAccountSupported = true;
  } else if (gasInfo.gasAccountScenarioReason) {
    gasAccountSupported = false;
  }

  return buildGasAccountAnalyticsContext({
    entryPoint,
    network: networkId,
    scenario: 'swap',
    gasAccountRequested,
    gasAccountSupported,
    gasAccountEligible: gasAccountRequested ? hasEligibleQuote : null,
    selectedPayer,
    effectiveFeePayer: gasInfo.payer ?? 'user',
    unavailableReason: getDirectSwapGasAccountUnavailableReason({
      hasEligibleQuote,
      useGasAccountByDefault,
      gasAccountCandidate,
      gasAccountScenarioReason: gasInfo.gasAccountScenarioReason,
    }),
    estimatedGasNative: originalTotalNative ?? totalNative,
    nativeBalance,
    nativePrincipal,
    extraFeeNative: getNativeOtherFeeAmount({ networkId, unsignedTx }),
    nativeTokenPrice: gasInfo.common.nativeTokenPrice,
    fiatCurrency,
    tokenPrincipalInsufficient: false,
    quoteId: gasInfo.gasAccountQuote?.quoteId,
    orderId: swapInfo.swapBuildResData.orderId,
  });
}

export function logDirectSwapGasAccountDecision(
  context: IGasAccountAnalyticsContext | undefined,
) {
  if (context) {
    defaultLogger.transaction.send.gasAccountDecision(context);
  }
}

export function buildDirectSwapGasAccountUiState({
  gasInfo,
  unsignedTx,
}: {
  gasInfo: ISwapGasInfo;
  unsignedTx: IUnsignedTxPro;
}): IGasAccountUiState | undefined {
  const quote = gasInfo.gasAccountQuote;
  if (
    !gasInfo.gasAccountEligible ||
    gasInfo.payer !== 'gasAccount' ||
    !quote?.quoteId
  ) {
    return undefined;
  }

  return {
    payer: 'gasAccount',
    gasAccountEligible: true,
    gasAccountQuote: quote,
    selectedPayer: 'gasAccount',
    lockedUserNonce:
      typeof unsignedTx.nonce === 'number' ? unsignedTx.nonce : undefined,
    idempotencyKey: `gas-account:${quote.quoteId}`,
  };
}

export async function runDirectSwapGasAccountStep<T>({
  context,
  failureStage,
  task,
}: {
  context: IGasAccountAnalyticsContext | undefined;
  failureStage: NonNullable<IGasAccountActionParams['failureStage']>;
  task: () => Promise<T>;
}): Promise<T> {
  try {
    return await task();
  } catch (error) {
    logDirectSwapGasAccountAction(context, {
      action: 'submitFailed',
      failureStage,
      errorCode: getGasAccountErrorCode(error),
    });
    throw error;
  }
}

export async function sendDirectSwapWithGasAccountAnalytics<T>({
  context,
  gasAccountUiState,
  send,
  onGasAccountError,
}: {
  context: IGasAccountAnalyticsContext | undefined;
  gasAccountUiState: IGasAccountUiState | undefined;
  send: (gasAccountUiState?: IGasAccountUiState) => Promise<T>;
  onGasAccountError?: (
    error: unknown,
    entry: NonNullable<ReturnType<typeof getGasAccountErrorEntry>>,
  ) => void | Promise<void>;
}): Promise<T> {
  let result: T;
  let effectiveFeePayer = context?.effectiveFeePayer ?? 'user';
  try {
    result = await send(gasAccountUiState);
  } catch (error) {
    const errorCode = getGasAccountErrorCode(error);
    logDirectSwapGasAccountAction(context, {
      action: 'submitFailed',
      failureStage: 'submit',
      errorCode,
    });
    const entry = gasAccountUiState
      ? getGasAccountErrorEntry(errorCode)
      : undefined;
    if (!entry) {
      throw error;
    }

    await onGasAccountError?.(error, entry);
    if (entry.strategy !== EGasAccountErrorStrategy.Fallback) {
      throw error;
    }

    logDirectSwapGasAccountAction(context, {
      action: 'payerChanged',
      fromPayer: 'gasAccount',
      toPayer: 'user',
      changeSource: 'system',
      changeReason: 'submitFailed',
      errorCode,
    });
    effectiveFeePayer = 'user';
    result = await runDirectSwapGasAccountStep({
      context: context ? { ...context, effectiveFeePayer } : undefined,
      failureStage: 'submit',
      task: () => send(),
    });
  }

  logDirectSwapGasAccountAction(
    context ? { ...context, effectiveFeePayer } : undefined,
    {
      action: 'submitSucceeded',
    },
  );
  return result;
}
