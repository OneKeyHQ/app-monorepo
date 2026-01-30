import { useEffect } from 'react';

import { isNativeTablet, useIsSplitView } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const isNative = platformEnv.isNative;

export const showTabBar = () => {
  setTimeout(() => {
    appEventBus.emit(EAppEventBusNames.HideTabBar, false);
  }, 100);
};

export const useNotifyTabBarDisplay = isNative
  ? (isActive: boolean) => {
      const isFocused = useIsFocused({ disableLockScreenCheck: true });
      const isLandscape = useIsSplitView();
      const isTablet = isNativeTablet();

      const hideTabBar = isActive && isFocused;

      useEffect(() => {
        if (isTablet && isLandscape) {
          return;
        }
        appEventBus.emit(EAppEventBusNames.HideTabBar, hideTabBar);
      }, [hideTabBar, isLandscape, isTablet]);
    }
  : () => {};
