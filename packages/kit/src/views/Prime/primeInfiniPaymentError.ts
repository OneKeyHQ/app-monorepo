/* cspell:ignore Infini */
import { Toast } from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

import { getPrimeInfiniPaymentLocalError } from './primeInfiniPaymentLogger';

export function showPrimeInfiniPaymentErrorToast({
  error,
  fallbackMessage,
}: {
  error: unknown;
  fallbackMessage: string;
}) {
  if (errorToastUtils.isUserCancelStyleError(error)) {
    return;
  }
  const message =
    getPrimeInfiniPaymentLocalError(error).errorMessage || fallbackMessage;
  console.error(`[PrimeInfiniPayment] ${message}`);
  Toast.error({ title: message });
  if (error && typeof error === 'object') {
    (error as IOneKeyError).$$autoToastErrorTriggered = true;
  }
}
