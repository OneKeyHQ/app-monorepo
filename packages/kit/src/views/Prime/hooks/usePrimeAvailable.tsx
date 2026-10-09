import { useMemo } from 'react';

import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function usePrimeAvailable() {
  const [devSettings] = useDevSettingsPersistAtom();

  const { user } = useOneKeyAuth();

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
