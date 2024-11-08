import { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { rootNavigationRef } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const getRootRoutersLength = () =>
  rootNavigationRef.current?.getState()?.routes?.length || 0;

export const useRouteIsFocused = ({
  disableLockScreenCheck = false,
}:
  | {
      disableLockScreenCheck?: boolean;
    }
  | undefined = {}) => {
  const [isLocked] = useAppIsLockedAtom();
  const isFocused = useIsFocused();

  const rootRoutersLength = useMemo(getRootRoutersLength, []);
  return (
    (disableLockScreenCheck ? true : !isLocked) &&
    isFocused &&
    // fix the issue where the current page remains in focus after multiple modals appear on Web.
    rootRoutersLength >= getRootRoutersLength()
  );
};
