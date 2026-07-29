import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { isTransientNetworkLikeError } from '@onekeyhq/shared/src/utils/transientNetworkErrorUtils';

import type { IntlShape } from 'react-intl';

// Returns undefined when the dialog must NOT toast: bridged server errors
// flagged autoToast are already surfaced by the global error toast with the
// server's own message, and a second generic toast here would contradict it.
export function getEmailOtpRequestErrorMessage({
  error,
  intl,
}: {
  error: unknown;
  intl: IntlShape;
}): string | undefined {
  const oneKeyError = error as
    | IOneKeyError<{ rest?: string | number }>
    | undefined;
  const rest = oneKeyError?.info?.rest;
  if (
    oneKeyError?.key === ETranslations.email_verification_rate_limit &&
    rest !== undefined
  ) {
    return intl.formatMessage(
      { id: ETranslations.email_verification_rate_limit },
      { rest },
    );
  }
  if (oneKeyError?.autoToast) {
    return undefined;
  }
  // Transient infrastructure failures (offline, 5xx, timeout) have a precise
  // name; rendering them as "unknown error" tells the user to retry blindly.
  if (
    oneKeyError?.key === ETranslations.global_network_error ||
    isTransientNetworkLikeError(error)
  ) {
    return intl.formatMessage({ id: ETranslations.global_network_error });
  }
  return intl.formatMessage({
    id: ETranslations.global_unknown_error_retry_message,
  });
}
