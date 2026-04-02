import { useIntl } from 'react-intl';

import { OrderedList } from '@onekeyhq/kit/src/components/TutorialsList/TutorialsList';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeTransferHomeSteps() {
  const intl = useIntl();

  return (
    <OrderedList
      tutorials={[
        {
          title: intl.formatMessage({ id: ETranslations.transfer_qr_step1 }),
        },
        {
          title: intl.formatMessage({ id: ETranslations.transfer_qr_step2 }),
        },
        {
          title: intl.formatMessage({ id: ETranslations.transfer_qr_step3 }),
        },
      ]}
    />
  );
}
