import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ELockDuration } from './const';

export function useOptions() {
  const intl = useIntl();
  return useMemo(
    () => [
      {
        title: intl.formatMessage({ id: 'form__always' }),
        value: ELockDuration.Always,
      },
      {
        title: intl.formatMessage({ id: 'form__str_minute' }, { '0': 1 }),
        value: ELockDuration.Minute,
      },
      {
        title: intl.formatMessage({ id: 'form__str_minute' }, { '0': 5 }),
        value: ELockDuration.Minute5,
      },
      {
        title: intl.formatMessage({ id: 'form__str_minute' }, { '0': 30 }),
        value: ELockDuration.Minute30,
      },
      {
        title: intl.formatMessage({ id: 'form__str_hour' }, { '0': 1 }),
        value: ELockDuration.Hour,
      },
      {
        title: intl.formatMessage({ id: 'form__str_hour' }, { '0': 4 }),
        value: ELockDuration.Hour4,
      },
      {
        title: 'Never',
        value: ELockDuration.Never,
      },
    ],
    [intl],
  );
}
