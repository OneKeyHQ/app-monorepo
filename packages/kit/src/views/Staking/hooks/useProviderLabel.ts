import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';

export const useProviderLabel = (name: string) => {
  const intl = useIntl();
  let label = intl.formatMessage({ id: ETranslations.global_protocol });
  if (earnUtils.isValidatorProvider({ providerName: name })) {
    label = intl.formatMessage({ id: ETranslations.earn_validator });
  } else if (name.toLowerCase() === 'babylogn') {
    label = intl.formatMessage({ id: ETranslations.earn_finality_provider });
  }
  return label;
};
