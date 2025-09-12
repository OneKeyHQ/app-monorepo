import { useMemo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

export function usePrimeAvailable() {
  const [devSettings] = useDevSettingsPersistAtom();

  const { user } = usePrimeAuthV2();

  const isPrimeAvailable =
    user?.isEnablePrime === true ||
    (devSettings.enabled && devSettings.settings?.showPrimeTest);

  return useMemo(
    () => ({
      isPrimeAvailable,
    }),
    [isPrimeAvailable],
  );
}
