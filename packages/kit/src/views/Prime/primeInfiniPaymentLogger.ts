/* cspell:ignore Infini */
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IPrimeCryptoPaymentFlowParams } from '@onekeyhq/shared/src/logger/scopes/prime/scenes/subscription';

type IPrimeInfiniPaymentLogParams = IPrimeCryptoPaymentFlowParams & {
  error?: unknown;
};

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
