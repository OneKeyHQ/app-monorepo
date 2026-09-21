import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/core';

import { rootNavigationRef } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';

export const getRootRoutersLength = () =>
  rootNavigationRef.current?.getRootState()?.routes?.length || 1;

export const useRouteIsFocused = ({
  disableLockScreenCheck = false,
  testID: _testID,
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

export const useRouteIsFocusedWhenEnabled = ({
  enabled,
  disableLockScreenCheck = false,
  testID: _testID,
}: {
  enabled: boolean;
  disableLockScreenCheck?: boolean;
  testID?: string;
}) => {
  const [isLocked] = useAppIsLockedAtom();
  const navigation = useNavigation();
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!enabled) {
        return () => undefined;
      }
      const unsubscribeFocus = navigation.addListener('focus', callback);
      const unsubscribeBlur = navigation.addListener('blur', callback);
      return () => {
        unsubscribeFocus();
        unsubscribeBlur();
      };
    },
    [enabled, navigation],
  );
  const getSnapshot = useCallback(
    () => (enabled ? navigation.isFocused() : true),
    [enabled, navigation],
  );
  const isFocused = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const rootRoutersLength = useMemo(getRootRoutersLength, []);

  return (
    (disableLockScreenCheck ? true : !isLocked) &&
    isFocused &&
    (!enabled || rootRoutersLength >= getRootRoutersLength())
  );
};
