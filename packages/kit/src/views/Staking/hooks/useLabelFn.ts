import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useEarnLabelFn() {
  const intl = useIntl();
  return function (label: string) {
    if (label.toLowerCase() === 'stake') {
      return intl.formatMessage({ id: ETranslations.earn_stake });
    }
    if (label.toLowerCase() === 'redeem') {
      return intl.formatMessage({ id: ETranslations.earn_redeem });
    }
    if (label.toLowerCase() === 'claim') {
      return intl.formatMessage({ id: ETranslations.earn_claim });
    }
    return label;
  };
}
