import { useEffect } from 'react';

import * as ExpoDevice from 'expo-device';

import { useOrientation } from '@onekeyhq/components';
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
      const isLandscape = useOrientation();

      const hideTabBar = isActive && isFocused;

      useEffect(() => {
        if (
          ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET &&
          isLandscape
        ) {
          return;
        }
        appEventBus.emit(EAppEventBusNames.HideTabBar, hideTabBar);
      }, [hideTabBar, isLandscape]);
    }
  : () => {};
