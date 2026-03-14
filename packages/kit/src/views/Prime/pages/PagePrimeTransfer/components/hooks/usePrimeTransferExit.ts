import { useCallback } from 'react';

import { resetAboveMainRoute } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';

export function usePrimeTransferExit() {
  const navigation = useAppNavigation();
  const [, setPrimeTransferAtom] = usePrimeTransferAtom();

  const exitTransferFlow = useCallback(
    (
      delay = 600,
      { skipCloseOnboardingPages }: { skipCloseOnboardingPages?: boolean } = {},
    ) => {
      setPrimeTransferAtom((v) => ({
        ...v,
        shouldPreventExit: false,
      }));
      setTimeout(async () => {
        navigation.popStack();
        if (!skipCloseOnboardingPages) {
          resetAboveMainRoute();
        }
      }, delay);
    },
    [navigation, setPrimeTransferAtom],
  );

  const disableExitPrevention = useCallback(() => {
    setPrimeTransferAtom((v) => ({
      ...v,
      shouldPreventExit: false,
    }));
  }, [setPrimeTransferAtom]);

  const enableExitPrevention = useCallback(() => {
    setPrimeTransferAtom((v) => ({
      ...v,
      shouldPreventExit: true,
    }));
  }, [setPrimeTransferAtom]);

  return {
    exitTransferFlow,
    disableExitPrevention,
    enableExitPrevention,
  };
}
