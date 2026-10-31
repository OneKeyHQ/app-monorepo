/* cspell:ignore Infini */

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IPrimeInfiniUnfinishedPaymentChoice } from '../../hooks/primeInfiniRemotePendingPayment';
import type { IntlShape } from 'react-intl';

export function showPrimeInfiniUnfinishedPaymentDialog({
  intl,
  canResume,
}: {
  intl: IntlShape;
  canResume: boolean;
}): Promise<IPrimeInfiniUnfinishedPaymentChoice> {
  return new Promise((resolve) => {
    let choice: IPrimeInfiniUnfinishedPaymentChoice = 'cancel';
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.prime_unfinished_payment__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.prime_unfinished_payment__desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.prime_start_new_payment__action,
      }),
      onCancelText: intl.formatMessage({
        id: canResume
          ? ETranslations.prime_keep_waiting__action
          : ETranslations.global_cancel,
      }),
      onConfirm: () => {
        choice = 'replace';
      },
      onCancel: () => {
        choice = canResume ? 'resume' : 'cancel';
      },
      onClose: () => resolve(choice),
    });
  });
}
