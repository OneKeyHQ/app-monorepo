import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IListItemSelectOption } from '../../components/ListItemSelect';

export function useOptions({
  disableCloudSyncDisallowedOptions,
}: {
  disableCloudSyncDisallowedOptions?: boolean;
} = {}) {
  const intl = useIntl();
  const [primeConfig] = usePrimeCloudSyncPersistAtom();

  const shouldDisableCloudSyncDisallowedOptions = useMemo(() => {
    return disableCloudSyncDisallowedOptions || primeConfig.isCloudSyncEnabled;
  }, [disableCloudSyncDisallowedOptions, primeConfig.isCloudSyncEnabled]);

  return useMemo<IListItemSelectOption<ELockDuration>[]>(
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
          id: ETranslations.settings_if_away_for_2_hrs,
        }),
        value: ELockDuration.Hour2,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.settings_if_away_for_4_hrs,
        }),
        subtitle: shouldDisableCloudSyncDisallowedOptions
          ? intl.formatMessage({
              id: ETranslations.prime_auto_lock_description,
            })
          : undefined,
        value: ELockDuration.Hour4,
        disabled: shouldDisableCloudSyncDisallowedOptions,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_never }),
        subtitle: shouldDisableCloudSyncDisallowedOptions
          ? intl.formatMessage({
              id: ETranslations.prime_auto_lock_description,
            })
          : undefined,
        value: ELockDuration.Never,
        disabled: shouldDisableCloudSyncDisallowedOptions,
      },
    ],
    [intl, shouldDisableCloudSyncDisallowedOptions],
  );
}
