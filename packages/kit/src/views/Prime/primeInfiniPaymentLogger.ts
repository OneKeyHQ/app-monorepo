/* cspell:ignore Infini */
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeCryptoPaymentFlowParams } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';

import { scrubSensitiveErrorMessageText } from '../../utils/sensitiveErrorMessageUtils';

import type { IPrimePurchaseMonitorEvent } from './hooks/usePrimePurchaseMonitor';

type IPrimeInfiniPaymentLogParams = IPrimeCryptoPaymentFlowParams & {
  error?: unknown;
};
type IPrimeInfiniPaymentMonitorLogContext = Omit<
  IPrimeCryptoPaymentFlowParams,
  'reason' | 'retryCount' | 'status'
>;

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

export function getPrimeInfiniPaymentLocalError(error: unknown) {
  const plainError = toPlainErrorObject(error);
  const safeError = getPrimeInfiniPaymentSafeError(error);
  const rawMessage =
    typeof error === 'string'
      ? error
      : (toOptionalString(plainError.message) ?? 'Unknown payment error');
  return {
    ...safeError,
    errorName:
      safeError.errorName ??
      (typeof error === 'string' ? 'StringError' : 'UnknownError'),
    errorMessage: scrubSensitiveErrorMessageText(rawMessage),
  };
}

export function logPrimeInfiniPaymentFlow({
  error,
  ...params
}: IPrimeInfiniPaymentLogParams) {
  const safeError = error ? getPrimeInfiniPaymentSafeError(error) : undefined;
  defaultLogger.prime.subscription.primeCryptoPaymentFlow({
    ...params,
    ...safeError,
  });
  if (error) {
    defaultLogger.prime.subscription.primeCryptoPaymentError({
      ...params,
      ...getPrimeInfiniPaymentLocalError(error),
    });
  }
}

export function logPrimeInfiniPaymentMonitorEvent<TData>({
  event,
  context,
  getFailureReason = (reason) => reason,
}: {
  event: IPrimePurchaseMonitorEvent<TData>;
  context: IPrimeInfiniPaymentMonitorLogContext;
  getFailureReason?: (reason: string) => string;
}) {
  if (event.type === 'started') {
    logPrimeInfiniPaymentFlow({
      ...context,
      status: 'started',
    });
  } else if (event.type === 'refreshed') {
    logPrimeInfiniPaymentFlow({
      ...context,
      status: 'refreshed',
      reason: 'manualRefresh',
    });
  } else if (event.type === 'failed') {
    logPrimeInfiniPaymentFlow({
      ...context,
      status: 'failed',
      retryCount: event.retryCount,
      reason: getFailureReason(event.issue.reason),
      error: event.issue.error,
    });
    event.issue.relatedIssues?.forEach((issue) => {
      logPrimeInfiniPaymentFlow({
        ...context,
        status: 'failed',
        retryCount: event.retryCount,
        reason: getFailureReason(issue.reason),
        error: issue.error,
      });
    });
  } else if (event.type === 'recovered') {
    logPrimeInfiniPaymentFlow({
      ...context,
      status: 'recovered',
      retryCount: event.retryCount,
    });
  } else if (event.type === 'timedOut') {
    logPrimeInfiniPaymentFlow({
      ...context,
      status: 'failed',
      reason: 'paymentDetectionTimedOut',
    });
  }
}
