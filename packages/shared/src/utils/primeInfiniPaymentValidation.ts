/* cspell:ignore Infini */
import BigNumber from 'bignumber.js';

import { PRIME_INFINI_MIN_PAYMENT_VALIDITY_MS } from '../consts/primeConsts';
import { OneKeyLocalError } from '../errors';

import {
  isPrimeInfiniPaymentExplicitlyExpiredSnapshot,
  isPrimeInfiniPaymentForAssetSnapshot,
  isSamePrimeInfiniPaymentTransferSnapshot,
} from './primeInfiniPaymentCacheUtils';

import type {
  IPrimeInfiniPayment,
  IPrimeInfiniPaymentAsset,
  IPrimeInfiniPaymentValidationFailure,
} from '../../types/prime/primeTypes';

export function getPrimeInfiniPaymentValidationFailure({
  payment,
  asset,
  previousPayment,
  validateQuote = true,
  now = Date.now(),
}: {
  payment: IPrimeInfiniPayment;
  asset?: IPrimeInfiniPaymentAsset;
  previousPayment?: IPrimeInfiniPayment;
  validateQuote?: boolean;
  now?: number;
}): IPrimeInfiniPaymentValidationFailure | undefined {
  if (
    !payment.paymentId?.trim() ||
    !payment.address?.trim() ||
    !payment.chain?.trim() ||
    !payment.token?.trim() ||
    !Number.isFinite(payment.expiresAt) ||
    !new BigNumber(payment.amountDue).isFinite() ||
    !new BigNumber(payment.amountDue).gt(0) ||
    [payment.amountConfirmed, payment.amountConfirming].some(
      (amount) =>
        amount !== undefined &&
        (!new BigNumber(amount).isFinite() || new BigNumber(amount).lt(0)),
    )
  ) {
    return 'invalidResponse';
  }
  if (asset && !isPrimeInfiniPaymentForAssetSnapshot({ payment, asset })) {
    return 'assetMismatch';
  }
  if (
    previousPayment &&
    asset &&
    !isSamePrimeInfiniPaymentTransferSnapshot({
      first: previousPayment,
      second: payment,
      networkId: asset.networkId,
    })
  ) {
    return 'transferSnapshotChanged';
  }
  if (validateQuote) {
    if (
      payment.expiresAt <= now ||
      isPrimeInfiniPaymentExplicitlyExpiredSnapshot(payment)
    ) {
      return 'quoteExpired';
    }
    if (payment.expiresAt <= now + PRIME_INFINI_MIN_PAYMENT_VALIDITY_MS) {
      return 'quoteValidityTooShort';
    }
  }
}

const failureMessages: Record<IPrimeInfiniPaymentValidationFailure, string> = {
  quoteExpired: 'Payment quote expired. Refresh and try again.',
  quoteValidityTooShort:
    'Payment quote expires too soon. Refresh and try again.',
  assetMismatch: 'Payment asset changed. Please review the selected asset.',
  transferSnapshotChanged:
    'Payment details changed. Please review the updated amount.',
  invalidResponse: 'Invalid Infini payment response',
  localPersistenceFailed:
    'Could not save the payment session. Please try again.',
};

export function createPrimeInfiniPaymentValidationError(
  failureReason: IPrimeInfiniPaymentValidationFailure,
  details?: {
    expectedChain: string;
    expectedToken: string;
    actualChain: string;
    actualToken: string;
  },
) {
  return new OneKeyLocalError({
    message:
      failureReason === 'assetMismatch' && details
        ? `Payment asset changed. Expected ${details.expectedChain}/${details.expectedToken}, received ${details.actualChain}/${details.actualToken}.`
        : failureMessages[failureReason],
    data: { paymentValidationFailure: failureReason, ...details },
    autoToast: false,
  });
}

export function toPrimeInfiniPaymentPersistenceError(error: unknown) {
  if (getPrimeInfiniPaymentErrorFailure(error)) {
    return error;
  }
  return new OneKeyLocalError({
    message:
      error instanceof OneKeyLocalError
        ? error.message
        : failureMessages.localPersistenceFailed,
    data: { paymentValidationFailure: 'localPersistenceFailed' },
    autoToast: false,
  });
}

export function getPrimeInfiniPaymentErrorFailure(error: unknown) {
  const reason = (
    error as { data?: { paymentValidationFailure?: unknown } } | undefined
  )?.data?.paymentValidationFailure;
  if (
    typeof reason === 'string' &&
    Object.prototype.hasOwnProperty.call(failureMessages, reason)
  ) {
    return reason as IPrimeInfiniPaymentValidationFailure;
  }
}
