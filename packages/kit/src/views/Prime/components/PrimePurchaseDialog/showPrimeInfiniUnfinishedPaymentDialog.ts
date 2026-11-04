/* cspell:ignore Infini */

import { Dialog } from '@onekeyhq/components';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import type { IPrimeInfiniUnfinishedPaymentChoice } from '../../hooks/primeInfiniRemotePendingPayment';
import type { IntlShape } from 'react-intl';

export function showPrimeInfiniUnfinishedPaymentDialog({
  intl,
  canResume,
  lookupUnavailable = false,
}: {
  intl: IntlShape;
  canResume: boolean;
  lookupUnavailable?: boolean;
}): Promise<IPrimeInfiniUnfinishedPaymentChoice> {
  return new Promise((resolve) => {
    let choice: IPrimeInfiniUnfinishedPaymentChoice = 'cancel';
    Dialog.show({
      title: lookupUnavailable
        ? intl.formatMessage({
            id: ETranslationsMock.prime_pending_payment_lookup_unavailable__title,
            defaultMessage:
              ETranslationsMock.prime_pending_payment_lookup_unavailable__title,
          })
        : intl.formatMessage({
            id: ETranslations.prime_unfinished_payment__title,
          }),
      description: lookupUnavailable
        ? intl.formatMessage({
            id: ETranslationsMock.prime_pending_payment_lookup_unavailable__desc,
            defaultMessage:
              ETranslationsMock.prime_pending_payment_lookup_unavailable__desc,
          })
        : intl.formatMessage({
            id: ETranslations.prime_unfinished_payment__desc,
          }),
      onConfirmText: intl.formatMessage({
        id: lookupUnavailable
          ? ETranslations.global_continue
          : ETranslations.prime_start_new_payment__action,
      }),
      onCancelText: intl.formatMessage({
        id:
          canResume && !lookupUnavailable
            ? ETranslations.prime_keep_waiting__action
            : ETranslations.global_cancel,
      }),
      onConfirm: () => {
        choice = 'replace';
      },
      onCancel: () => {
        choice = canResume && !lookupUnavailable ? 'resume' : 'cancel';
      },
      onClose: () => resolve(choice),
    });
  });
}
