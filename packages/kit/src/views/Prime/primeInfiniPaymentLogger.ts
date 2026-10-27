/* cspell:ignore Infini */
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeCryptoPaymentFlowParams } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';
import { getPrimeInfiniPaymentSafeError } from '@onekeyhq/shared/src/utils/primeInfiniPaymentDiagnostics';
import { getPrimeInfiniPaymentErrorFailure } from '@onekeyhq/shared/src/utils/primeInfiniPaymentValidation';

import { scrubSensitiveErrorMessageText } from '../../utils/sensitiveErrorMessageUtils';

import type { IPrimePurchaseMonitorEvent } from './hooks/usePrimePurchaseMonitor';

export { getPrimeInfiniPaymentSafeError } from '@onekeyhq/shared/src/utils/primeInfiniPaymentDiagnostics';

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

export function getPrimeInfiniPaymentLocalError(error: unknown) {
  const plainError = toPlainErrorObject(error);
  const safeError = getPrimeInfiniPaymentSafeError(error);
  const rawMessage =
    typeof error === 'string'
      ? toOptionalString(error)
      : toOptionalString(plainError.message);
  return {
    ...safeError,
    errorName:
      safeError.errorName ??
      (typeof error === 'string' ? 'StringError' : 'UnknownError'),
    errorMessage: rawMessage
      ? scrubSensitiveErrorMessageText(rawMessage)
      : undefined,
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
    failureReason:
      params.failureReason ?? getPrimeInfiniPaymentErrorFailure(error),
  });
  if (error) {
    defaultLogger.prime.subscription.primeCryptoPaymentError({
      ...params,
      ...safeError,
      failureReason:
        params.failureReason ?? getPrimeInfiniPaymentErrorFailure(error),
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
