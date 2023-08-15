import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import { isNil } from 'lodash';

import type { IDesktopAppState } from '@onekeyhq/desktop/src-electron/preload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes } from '../routes/routesEnum';
import { isAtAppRootTab } from '../utils/routeUtils';

import { useHomeTabName } from './useHomeTabName';

import type { WalletHomeTabEnum } from '../views/Wallet/type';

export function useIsFocusedAllInOne({
  focusDelay,
  blurDelay,
  checkVisibility = true,
  homeTabName,
  rootTabName,
}: {
  focusDelay?: number;
  blurDelay?: number;
  checkVisibility?: boolean;
  homeTabName?: WalletHomeTabEnum;
  rootTabName?: TabRoutes;
} = {}): {
  isFocused: boolean; // current router focused
  homeTabFocused?: boolean; // home tab focused
  rootTabFocused?: boolean; // root tab (or tab sub router) focused
} {
  const [isFocused, setIsFocused] = useState(false);
  const blurTimer = useRef<NodeJS.Timeout | null>(null);
  const focusTimer = useRef<NodeJS.Timeout | null>(null);
  const clearAllTimer = useCallback(() => {
    clearTimeout(blurTimer.current as any);
    clearTimeout(focusTimer.current as any);
  }, []);

  const currentHomeTab = useHomeTabName();
  const homeTabFocused = useMemo(() => {
    if (isNil(homeTabName)) {
      return undefined;
    }
    if (isFocused) {
      // for hooks deps only
    }
    return (
      homeTabName &&
      currentHomeTab === homeTabName &&
      isAtAppRootTab(TabRoutes.Home)
    );
  }, [currentHomeTab, homeTabName, isFocused]);

  const rootTabFocused = useMemo(() => {
    if (isNil(rootTabName)) {
      return undefined;
    }
    if (isFocused) {
      // for hooks deps only
    }
    return isAtAppRootTab(rootTabName);
  }, [isFocused, rootTabName]);

  const onBlur = useCallback(() => {
    clearAllTimer();
    if (blurDelay) {
      blurTimer.current = setTimeout(() => {
        setIsFocused(false);
      }, blurDelay);
    } else {
      setIsFocused(false);
    }
  }, [blurDelay, clearAllTimer]);

  const onFocus = useCallback(() => {
    clearAllTimer();
    if (focusDelay) {
      focusTimer.current = setTimeout(() => {
        setIsFocused(true);
      }, focusDelay);
    } else {
      setIsFocused(true);
    }
  }, [clearAllTimer, focusDelay]);

  const desktopVisiblityUpdate = useCallback(
    (state: IDesktopAppState) => {
      if (!checkVisibility) {
        return;
      }
      if (!platformEnv.isDesktop) {
        return;
      }
      if (state === 'active') {
        onFocus();
      } else {
        onBlur();
      }
    },
    [checkVisibility, onBlur, onFocus],
  );

  const webVisiblityUpdate = useCallback(() => {
    if (!checkVisibility) {
      return;
    }
    if (!platformEnv.isRuntimeBrowser) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      onBlur();
    }
    if (document.visibilityState === 'visible') {
      onFocus();
    }
  }, [checkVisibility, onBlur, onFocus]);

  useEffect(() => {
    let remove: () => void;
    if (platformEnv.isDesktop) {
      remove = window.desktopApi.onAppState(desktopVisiblityUpdate);
    }
    return () => {
      remove?.();
    };
  }, [desktopVisiblityUpdate]);

  useFocusEffect(
    useCallback(() => {
      onFocus();

      const listenVisibility =
        platformEnv.isRuntimeBrowser &&
        !platformEnv.isDesktop &&
        checkVisibility;

      if (listenVisibility) {
        document.addEventListener('visibilitychange', webVisiblityUpdate);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
      }

      return () => {
        onBlur();
        if (listenVisibility) {
          document.removeEventListener('visibilitychange', webVisiblityUpdate);
          window.removeEventListener('blur', onBlur);
          window.removeEventListener('focus', onFocus);
        }
      };
    }, [checkVisibility, onBlur, onFocus, webVisiblityUpdate]),
  );

  const result = useMemo(
    () => ({ isFocused, homeTabFocused, rootTabFocused }),
    [homeTabFocused, isFocused, rootTabFocused],
  );

  return result;
}
