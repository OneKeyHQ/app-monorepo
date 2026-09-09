import { useCallback, useMemo } from 'react';

import { createIntl, createIntlCache, useIntl } from 'react-intl';

import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

const mockIntlCache = createIntlCache();

export function usePrimeGiftMessages() {
  const intl = useIntl();
  const mockIntl = useMemo(
    () =>
      createIntl(
        { locale: intl.locale, defaultLocale: intl.locale },
        mockIntlCache,
      ),
    [intl.locale],
  );
  return useCallback(
    (id: ETranslationsMock, values?: Record<string, string | number>) =>
      mockIntl.formatMessage({ id, defaultMessage: id }, values),
    [mockIntl],
  );
}

export function usePrimeGiftReasonMessage() {
  const intl = useIntl();
  const message = usePrimeGiftMessages();
  return useCallback(
    (reason: string | undefined) => {
      switch (reason) {
        case 'campaign_unavailable':
          return message(ETranslationsMock.prime_gift_unavailable);
        case 'already_redeemed':
          return message(ETranslationsMock.prime_gift_claimed);
        case 'account_changed':
          return message(ETranslationsMock.prime_gift_session_changed);
        case 'paid_prime_active':
          return intl.formatMessage({
            id: ETranslations.prime_redemption_paid_subscription_blocked__desc,
          });
        case 'account_eligibility_unavailable':
          return message(ETranslationsMock.prime_gift_error);
        case 'claim_result_unknown':
          return message(ETranslationsMock.prime_gift_result_unknown);
        default:
          return reason;
      }
    },
    [intl, message],
  );
}
