import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function UnsupportedSwapWarning({
  customMessage,
}: {
  customMessage?: string;
}) {
  const intl = useIntl();

  return (
    <Alert
      icon="InfoCircleOutline"
      title={intl.formatMessage({
        id: ETranslations.dexmarket_swap_unsupported_title,
      })}
      type="warning"
      description={
        customMessage ||
        intl.formatMessage({
          id: ETranslations.dexmarket_swap_unsupported_desc,
        })
      }
    />
  );
}
