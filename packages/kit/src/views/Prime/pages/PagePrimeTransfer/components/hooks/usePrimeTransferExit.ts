import { useCallback } from 'react';

import { resetAboveMainRoute, resetPrimeModal } from '@onekeyhq/components';
import { usePrimeTransferAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';

export function usePrimeTransferExit() {
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
      setTimeout(() => {
        // Atomic resets skip the popStack() animated dismiss that triggers
        // the iOS RNSScreenStack window=NIL retry storm.
        if (skipCloseOnboardingPages) {
          // Close only PrimeModal (transfer flow) — preserve any parent
          // overlay (e.g. the onboarding modal the user came from).
          resetPrimeModal();
        } else {
          // Full cleanup — drop every overlay above Main. Used when the
          // transfer completes end-to-end and the user should land on home.
          resetAboveMainRoute();
        }
      }, delay);
    },
    [setPrimeTransferAtom],
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
