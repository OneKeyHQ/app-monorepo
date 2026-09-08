/* cspell:ignore Infini */
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import stringUtils from './stringUtils';

import type { IPrimeInfiniPayment } from '../../types/prime/primeTypes';

export function getPrimeInfiniPaymentWarningsFingerprint(
  payment: IPrimeInfiniPayment,
) {
  return bytesToHex(
    sha256(stringUtils.stableStringify(payment.warningMessages ?? [])),
  );
}

export function hasUnconfirmedPrimeInfiniPaymentWarnings({
  payment,
  confirmedWarningsFingerprint,
}: {
  payment: IPrimeInfiniPayment;
  confirmedWarningsFingerprint?: string;
}) {
  return Boolean(
    payment.warningMessages?.length &&
    getPrimeInfiniPaymentWarningsFingerprint(payment) !==
      confirmedWarningsFingerprint,
  );
}
