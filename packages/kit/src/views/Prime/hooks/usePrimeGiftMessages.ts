import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

export function usePrimeGiftMessages() {
  const intl = useIntl();
  return useCallback(
    (id: ETranslations, values?: Record<string, string | number>) =>
      intl.formatMessage({ id }, values),
    [intl],
  );
}

export function usePrimeGiftReasonMessage() {
  const message = usePrimeGiftMessages();
  return useCallback(
    (reason: string | undefined) => {
      switch (reason) {
        case 'campaign_unavailable':
          return message(ETranslations.prime_gift_unavailable__msg);
        case 'already_redeemed':
          return message(ETranslations.prime_gift_already_claimed__msg);
        case 'account_changed':
          return message(ETranslations.prime_onekey_id_session_changed__msg);
        case 'claim_result_unknown':
          return message(ETranslations.prime_gift_result_unknown__msg);
        default:
          return reason;
      }
    },
    [message],
  );
}
