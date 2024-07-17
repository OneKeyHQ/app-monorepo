import { useIsFocused } from '@react-navigation/core';

import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export const useRouteIsFocused = (disableLockScreenCheck = false) => {
  const [isLocked] = useAppIsLockedAtom();
  const isFocused = useIsFocused();
  return (disableLockScreenCheck ? true : !isLocked) && isFocused;
};
