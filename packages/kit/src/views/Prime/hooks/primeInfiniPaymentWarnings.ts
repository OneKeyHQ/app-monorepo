/* cspell:ignore Infini */
import type { IPrimeInfiniPayment } from '@onekeyhq/shared/types/prime/primeTypes';

export async function confirmPrimeInfiniPaymentWarnings({
  payment,
  confirmWarnings,
  shouldContinue,
}: {
  payment: IPrimeInfiniPayment;
  confirmWarnings: (messages: string[]) => Promise<boolean>;
  shouldContinue: () => boolean;
}) {
  if (!shouldContinue()) {
    return false;
  }
  const warnings = payment.warningMessages;
  if (warnings?.length && !(await confirmWarnings([...warnings]))) {
    return false;
  }
  return shouldContinue();
}
