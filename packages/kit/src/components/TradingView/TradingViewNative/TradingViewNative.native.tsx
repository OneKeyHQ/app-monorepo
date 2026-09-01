import { useEffect } from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { noop } from 'lodash';
import {
  AppState,
  Dimensions,
  StatusBar,
  useWindowDimensions,
} from 'react-native';

import { isSpanning } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewNativeContainer } from './TradingViewNativeContainer';
import { shouldHideTradingViewNativeStatusBar } from './utils/fullscreenLayout';

import type { ITradingViewNativeProps } from './types';

function shouldUseCurrentAndroidWindowForFullscreen() {
  if (!platformEnv.isNativeAndroid) {
    return false;
  }
  if (isSpanning()) {
    return true;
  }
  const { height, width } = Dimensions.get('window');
  return width > height;
}

function getDefaultOrientationLock(shouldUseCurrentAndroidWindow: boolean) {
  if (platformEnv.isNativeIOSPad) {
    return ScreenOrientation.OrientationLock.ALL;
  }
  if (shouldUseCurrentAndroidWindow) {
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
  const { height, width } = useWindowDimensions();
  const isAndroid = platformEnv.isNativeAndroid === true;
  const shouldHideStatusBar = shouldHideTradingViewNativeStatusBar({
    height,
    isAndroid,
    isFullscreen,
    isSpanningWindow: isAndroid && isSpanning(),
    width,
  });

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    let isActive = true;
    const shouldUseCurrentAndroidWindow =
      shouldUseCurrentAndroidWindowForFullscreen();
    if (!shouldUseCurrentAndroidWindow) {
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
        if (nextState === 'background') {
          onNativeChartFullscreenChange?.(false);
        }
      },
    );

    return () => {
      isActive = false;
      appStateSubscription.remove();
      lockScreenOrientation(
        getDefaultOrientationLock(shouldUseCurrentAndroidWindow),
      );
    };
  }, [isFullscreen, onNativeChartFullscreenChange]);

  return (
    <>
      {shouldHideStatusBar ? <StatusBar hidden /> : null}
      <TradingViewNativeContainer {...props} />
    </>
  );
}
