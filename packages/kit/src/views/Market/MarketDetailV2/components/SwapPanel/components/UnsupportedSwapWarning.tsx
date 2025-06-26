import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function UnsupportedSwapWarning() {
  const intl = useIntl();

  return (
    <Alert
      icon="InfoCircleOutline"
      title={intl.formatMessage({
        id: ETranslations.dexmarket_swap_unsupported_title,
      })}
      type="warning"
      description={intl.formatMessage({
        id: ETranslations.dexmarket_swap_unsupported_desc,
      })}
    />
  );
}
