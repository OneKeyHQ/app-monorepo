import { useEffect } from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { noop } from 'lodash';
import { AppState } from 'react-native';

import { isNativeTablet } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNativeContainer } from './TradingViewNativeContainer';

import type { ITradingViewNativeProps } from './types';

function isAndroidTablet() {
  return platformEnv.isNativeAndroid && isNativeTablet();
}

function getDefaultOrientationLock() {
  if (platformEnv.isNativeIOSPad) {
    return ScreenOrientation.OrientationLock.ALL;
  }
  if (isAndroidTablet()) {
    return ScreenOrientation.OrientationLock.DEFAULT;
  }
  return ScreenOrientation.OrientationLock.PORTRAIT_UP;
}

function lockScreenOrientation(
  orientationLock: ScreenOrientation.OrientationLock,
) {
  void ScreenOrientation.lockAsync(orientationLock).catch(noop);
}

export function TradingViewNative(props: ITradingViewNativeProps) {
  const isFullscreen = Boolean(props.isNativeChartFullscreen);
  const { onNativeChartFullscreenChange } = props;

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    let isActive = true;
    if (!isAndroidTablet()) {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      ).catch(() => {
        if (isActive) {
          onNativeChartFullscreenChange?.(false);
        }
      });
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState !== 'active') {
          onNativeChartFullscreenChange?.(false);
        }
      },
    );

    return () => {
      isActive = false;
      appStateSubscription.remove();
      lockScreenOrientation(getDefaultOrientationLock());
    };
  }, [isFullscreen, onNativeChartFullscreenChange]);

  return <TradingViewNativeContainer {...props} />;
}
