import { useMemo } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { rootNavigationRef } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const getRootRoutersLength = () =>
  rootNavigationRef.current?.getRootState()?.routes?.length || 1;

export const useRouteIsFocused = ({
  disableLockScreenCheck = false,
  testID,
}:
  | {
      disableLockScreenCheck?: boolean;
      testID?: string;
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
