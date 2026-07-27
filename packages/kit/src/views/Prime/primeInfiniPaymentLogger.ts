/* cspell:ignore Infini */
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeCryptoPaymentFlowParams } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';

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
  return {
    errorName:
      toOptionalString(plainError.name) ??
      toOptionalString(plainError.className) ??
      toOptionalString(plainError.constructorName),
    errorCode:
      toOptionalString(plainError.code) ?? toOptionalString(plainError.key),
    requestId: toOptionalString(plainError.requestId),
    httpStatusCode:
      typeof plainError.httpStatusCode === 'number' &&
      Number.isFinite(plainError.httpStatusCode)
        ? plainError.httpStatusCode
        : undefined,
  };
}

export function logPrimeInfiniPaymentFlow({
  error,
  ...params
}: IPrimeInfiniPaymentLogParams) {
  defaultLogger.prime.subscription.primeCryptoPaymentFlow({
    ...params,
    ...(error ? getPrimeInfiniPaymentSafeError(error) : undefined),
  });
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
