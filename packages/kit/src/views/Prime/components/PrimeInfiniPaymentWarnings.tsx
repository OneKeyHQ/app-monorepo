/* cspell:ignore Infini */
import { Dialog, UnOrderedList } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

export function showPrimeInfiniPaymentWarnings(
  warningMessages: string[],
  intl: IntlShape,
) {
  return new Promise<boolean>((resolve) => {
    let confirmed = false;
    Dialog.show({
      testID: 'prime-infini-payment-warnings',
      title: intl.formatMessage({ id: ETranslations.global_warning }),
      tone: 'warning',
      renderContent: (
        <Dialog.ScrollView maxHeight={360}>
          <UnOrderedList>
            {warningMessages.map((message, index) => (
              <UnOrderedList.Item key={index} titleSize="$bodyMd">
                {message}
              </UnOrderedList.Item>
            ))}
          </UnOrderedList>
        </Dialog.ScrollView>
      ),
      showCancelButton: true,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onConfirm: () => {
        confirmed = true;
      },
      onClose: async () => {
        resolve(confirmed);
      },
    });
  });
}
