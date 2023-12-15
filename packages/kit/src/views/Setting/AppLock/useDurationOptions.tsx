import { useMemo } from 'react';

import { useIntl } from 'react-intl';

export function useDurationOptions() {
  const intl = useIntl();
  return useMemo(
    () => [
      {
        title: intl.formatMessage({ id: 'form__always' }),
        value: '0',
      },
      {
        title: intl.formatMessage({ id: 'form__str_minute' }, { '0': 1 }),
        value: '1',
      },
      {
        title: intl.formatMessage({ id: 'form__str_minute' }, { '0': 5 }),
        value: '5',
      },
      {
        title: intl.formatMessage({ id: 'form__str_minute' }, { '0': 30 }),
        value: '30',
      },
      {
        title: intl.formatMessage({ id: 'form__str_hour' }, { '0': 1 }),
        value: '60',
      },
      {
        title: intl.formatMessage({ id: 'form__str_hour' }, { '0': 4 }),
        value: '240',
      },
      {
        title: 'Never',
        value: '10000000000000',
      },
    ],
    [intl],
  );
}
