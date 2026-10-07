import { useEffect } from 'react';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { setHideTabBarRequest } from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

const isNative = platformEnv.isNative;

// The browser is a single tab root, so one owner id covers every call site here.
const BROWSER_HIDE_TAB_BAR_OWNER_ID = 'discovery-browser';

let showTabBarTimer: ReturnType<typeof setTimeout> | null = null;

const cancelPendingShowTabBar = () => {
  if (showTabBarTimer) {
    clearTimeout(showTabBarTimer);
    showTabBarTimer = null;
  }
};

export const showTabBar = () => {
  cancelPendingShowTabBar();
  showTabBarTimer = setTimeout(() => {
    showTabBarTimer = null;
    setHideTabBarRequest(BROWSER_HIDE_TAB_BAR_OWNER_ID, false);
  }, 100);
};

export const useNotifyTabBarDisplay = isNative
  ? (isActive: boolean) => {
      const isFocused = useIsFocused({ disableLockScreenCheck: true });

      const hideTabBar = isActive && isFocused;

      useEffect(() => {
        if (hideTabBar) {
          cancelPendingShowTabBar();
        }
        setHideTabBarRequest(BROWSER_HIDE_TAB_BAR_OWNER_ID, hideTabBar);
        return () => {
          setHideTabBarRequest(BROWSER_HIDE_TAB_BAR_OWNER_ID, false);
        };
      }, [hideTabBar]);
    }
  : () => {};
