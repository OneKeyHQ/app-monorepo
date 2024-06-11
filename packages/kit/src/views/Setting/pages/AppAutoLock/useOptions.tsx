import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function useOptions() {
  const intl = useIntl();
  return useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.global_always }),
        value: ELockDuration.Always,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_if_away_for_1_min,
        }),
        value: ELockDuration.Minute,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_if_away_for_5_mins,
        }),
        value: ELockDuration.Minute5,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_if_away_for_30_mins,
        }),
        value: ELockDuration.Minute30,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_if_away_for_1_hr,
        }),
        value: ELockDuration.Hour,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_if_away_for_4_hrs,
        }),
        value: ELockDuration.Hour4,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_never }),
        value: ELockDuration.Never,
      },
    ],
    [intl],
  );
}
