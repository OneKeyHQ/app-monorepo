import { useMemo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePrimeAuthV2 } from './usePrimeAuthV2';

export function usePrimeAvailable() {
  const [devSettings] = useDevSettingsPersistAtom();

  const { user } = usePrimeAuthV2();

  const isPrimeAvailable = useMemo(() => {
    if (devSettings.enabled && devSettings.settings?.showPrimeTest) {
      return true;
    }
    if (platformEnv.isMas && !user?.primeSubscription?.isActive) {
      return false;
    }
    return true;
  }, [
    devSettings.enabled,
    devSettings.settings?.showPrimeTest,
    user?.primeSubscription?.isActive,
  ]);
  return useMemo(
    () => ({
      isPrimeAvailable,
    }),
    [isPrimeAvailable],
  );
}
