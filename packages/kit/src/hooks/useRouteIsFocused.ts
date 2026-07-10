import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';

import { useIsFocused, useNavigation } from '@react-navigation/core';

import { rootNavigationRef, useOnRouterChange } from '@onekeyhq/components';
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

export const useRouteIsFocusedRef = ({
  disableLockScreenCheck = false,
  onChangeRef,
  overrideIsFocused,
  testID: _testID,
}: {
  disableLockScreenCheck?: boolean;
  onChangeRef: MutableRefObject<((isFocused: boolean) => void) | undefined>;
  overrideIsFocused?: (isFocused: boolean) => boolean;
  testID?: string;
}) => {
  const navigation = useNavigation();
  const [isLocked] = useAppIsLockedAtom();
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const overrideIsFocusedRef = useRef(overrideIsFocused);
  overrideIsFocusedRef.current = overrideIsFocused;
  const rootRoutersLength = useMemo(getRootRoutersLength, []);

  const getIsFocused = useCallback(() => {
    const isFocused =
      (disableLockScreenCheck || !isLockedRef.current) &&
      navigation.isFocused() &&
      rootRoutersLength >= getRootRoutersLength();
    return overrideIsFocusedRef.current?.(isFocused) ?? isFocused;
  }, [disableLockScreenCheck, navigation, rootRoutersLength]);

  const renderFocusedValue = getIsFocused();
  const isFocusedRef = useRef(renderFocusedValue);
  isFocusedRef.current = renderFocusedValue;
  const notifiedFocusedRef = useRef<boolean | undefined>(undefined);

  const notifyFocusChange = useCallback(
    (isFocused: boolean) => {
      isFocusedRef.current = isFocused;
      if (notifiedFocusedRef.current === isFocused) {
        return;
      }
      notifiedFocusedRef.current = isFocused;
      onChangeRef.current?.(isFocused);
    },
    [onChangeRef],
  );

  // Navigation focus is a gate for async work, not rendered output. Updating a
  // ref from the router event avoids forcing every data hook consumer to
  // re-render together during a tab switch.
  useOnRouterChange(() => notifyFocusChange(getIsFocused()));

  // Re-evaluate lock state and caller overrides when their owning component
  // renders for a reason unrelated to navigation.
  useEffect(() => {
    notifyFocusChange(renderFocusedValue);
  }, [notifyFocusChange, renderFocusedValue]);

  return isFocusedRef;
};
