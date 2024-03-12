import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { LOCALES_OPTION } from '@onekeyhq/shared/src/locale';

export function useLocaleOptions() {
  const intl = useIntl();
  const localeOptions = useMemo(
    () =>
      [
        {
          label: intl.formatMessage({
            id: 'form__auto',
            defaultMessage: 'System',
          }),
          value: 'system',
        },
      ].concat(LOCALES_OPTION),
    [intl],
  );
  return localeOptions;
}
