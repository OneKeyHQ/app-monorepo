/* cspell:ignore Infini */
import type { IPrimeInfiniPayment } from '@onekeyhq/shared/types/prime/primeTypes';

export async function confirmPrimeInfiniPaymentWarnings({
  payment,
  fallbackWarningMessages,
  confirmWarnings,
  shouldContinue,
}: {
  payment: Pick<IPrimeInfiniPayment, 'warningMessages'>;
  fallbackWarningMessages?: readonly string[];
  confirmWarnings: (messages: string[]) => Promise<boolean>;
  shouldContinue: () => boolean;
}) {
  if (!shouldContinue()) {
    return false;
  }
  // Keep fallback text out of the payment snapshot and its consent fingerprint.
  const warnings = payment.warningMessages?.length
    ? payment.warningMessages
    : fallbackWarningMessages;
  if (warnings?.length && !(await confirmWarnings([...warnings]))) {
    return false;
  }
  return shouldContinue();
}
