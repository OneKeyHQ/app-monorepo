import { useMemo } from 'react';

import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsShouldShowEnableTradingButtonAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function usePerpShouldShowEnableTradingButton() {
  const [shouldShowEnableTradingButton] =
    usePerpsShouldShowEnableTradingButtonAtom();
  return shouldShowEnableTradingButton;
}

export function usePerpEnableTradingStatus() {
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();

  const isAccountLoading = useMemo(() => {
    return (
      perpsAccountLoading.enableTradingLoading ||
      perpsAccountLoading.selectAccountLoading
    );
  }, [
    perpsAccountLoading.enableTradingLoading,
    perpsAccountLoading.selectAccountLoading,
  ]);

  const shouldShowEnableTradingButton = usePerpShouldShowEnableTradingButton();

  return {
    perpsAccount,
    perpsAccountStatus,
    perpsAccountLoading,
    isAccountLoading,
    shouldShowEnableTradingButton,
  };
}
