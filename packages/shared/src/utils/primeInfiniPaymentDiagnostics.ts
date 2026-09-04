/* cspell:ignore Infini */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import { toPlainErrorObject } from '../errors/utils/errorUtils';

import type { IPrimeCryptoPaymentFlowParams } from '../logger/scopes/prime/scenes/subscription';

function diagnosticLabel(value: string | undefined, maxLength = 64) {
  return typeof value === 'string' &&
    value.length <= maxLength &&
    /^[a-zA-Z0-9_:-]+$/.test(value)
    ? value
    : undefined;
}

export function getPrimeInfiniPaymentSafeLogParams(
  params: IPrimeCryptoPaymentFlowParams,
): IPrimeCryptoPaymentFlowParams {
  // Explicit fields keep API payloads, wallet/user identifiers, and server
  // warning text out of both local and server logs, including bg callers.
  return {
    stage: params.stage,
    status: params.status,
    flowId: diagnosticLabel(params.flowId),
    paymentSource: params.paymentSource,
    failureReason: diagnosticLabel(params.failureReason),
    subscriptionPeriod: params.subscriptionPeriod,
    featureName: params.featureName,
    plan: params.plan,
    checkoutType: params.checkoutType,
    paymentId:
      typeof params.paymentId === 'string' && params.paymentId
        ? `sha256:${bytesToHex(sha256(params.paymentId)).slice(0, 16)}`
        : undefined,
    networkId: diagnosticLabel(params.networkId, 32),
    tokenSymbol: diagnosticLabel(params.tokenSymbol, 16),
    expectedChain: diagnosticLabel(params.expectedChain, 16),
    expectedToken: diagnosticLabel(params.expectedToken, 16),
    actualChain: diagnosticLabel(params.actualChain, 16),
    actualToken: diagnosticLabel(params.actualToken, 16),
    amountDue:
      params.amountDue && /^[0-9.]{1,40}$/.test(params.amountDue)
        ? params.amountDue
        : undefined,
    remainingMs: params.remainingMs,
    sessionAgeMs: params.sessionAgeMs,
    sessionMode: params.sessionMode,
    sendStarted: params.sendStarted,
    hasBeforeBroadcastAction: params.hasBeforeBroadcastAction,
    isDevModeEnabled: params.isDevModeEnabled,
    isAlwaysSignOnlySendTxConfigured: params.isAlwaysSignOnlySendTxConfigured,
    isSignOnlyRequested: params.isSignOnlyRequested,
    isExternalAccount: params.isExternalAccount,
    hasCompletedBeforeBroadcastAction: params.hasCompletedBeforeBroadcastAction,
    hasAttemptedBroadcast: params.hasAttemptedBroadcast,
    hasBroadcastTxId: params.hasBroadcastTxId,
    isWithoutBroadcastTxIdAllowed: params.isWithoutBroadcastTxIdAllowed,
    hasPaymentProgress: params.hasPaymentProgress,
    createNewPaymentIntent: params.createNewPaymentIntent,
    reason: diagnosticLabel(params.reason),
    isRetry: params.isRetry,
    durationMs: params.durationMs,
    retryCount: params.retryCount,
    errorName: diagnosticLabel(params.errorName),
    errorCode: diagnosticLabel(params.errorCode),
    requestId: diagnosticLabel(params.requestId),
    httpStatusCode: params.httpStatusCode,
  };
}

function toOptionalString(value: unknown) {
  if (typeof value === 'string' && value) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function getPrimeInfiniPaymentSafeError(error: unknown) {
  const plainError = toPlainErrorObject(error);
  const responseStatus = (error as { response?: { status?: unknown } } | null)
    ?.response?.status;
  let httpStatusCode: number | undefined;
  if (
    typeof plainError.httpStatusCode === 'number' &&
    Number.isFinite(plainError.httpStatusCode)
  ) {
    httpStatusCode = plainError.httpStatusCode;
  } else if (
    typeof responseStatus === 'number' &&
    Number.isFinite(responseStatus)
  ) {
    httpStatusCode = responseStatus;
  }
  return {
    errorName:
      toOptionalString(plainError.name) ??
      toOptionalString(plainError.className) ??
      toOptionalString(plainError.constructorName),
    errorCode:
      toOptionalString(plainError.code) ?? toOptionalString(plainError.key),
    requestId: toOptionalString(plainError.requestId),
    httpStatusCode,
  };
}
