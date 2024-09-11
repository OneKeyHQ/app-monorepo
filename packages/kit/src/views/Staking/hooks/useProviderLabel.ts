import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

export const useProviderLabel = (name: string) => {
  const intl = useIntl();
  let label = intl.formatMessage({ id: ETranslations.global_protocol });
  if (name.toLowerCase() === 'everstake') {
    label = intl.formatMessage({ id: ETranslations.earn_validator });
  } else if (name.toLowerCase() === 'babylogn') {
    label = intl.formatMessage({ id: ETranslations.earn_finality_provider });
  }
  return label;
};
