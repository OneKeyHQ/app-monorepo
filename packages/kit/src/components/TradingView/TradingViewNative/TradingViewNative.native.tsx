import { useLayoutEffect, useRef } from 'react';

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
  const onFullscreenChangeRef = useRef(onNativeChartFullscreenChange);
  useLayoutEffect(() => {
    onFullscreenChangeRef.current = onNativeChartFullscreenChange;
  }, [onNativeChartFullscreenChange]);
  const { height, width } = useWindowDimensions();
  const isAndroid = platformEnv.isNativeAndroid === true;
  const shouldHideStatusBar = shouldHideTradingViewNativeStatusBar({
    height,
    isAndroid,
    isFullscreen,
    isSpanningWindow: isAndroid && isSpanning(),
    width,
  });

  useLayoutEffect(() => {
    if (!isFullscreen) {
      return;
    }

    let isActive = true;
    // iPadOS can resize the app window instead of rotating it when locking orientation.
    const shouldManageOrientation = !platformEnv.isNativeIOSPad;
    const shouldUseCurrentAndroidWindow =
      shouldUseCurrentAndroidWindowForFullscreen();
    if (shouldManageOrientation && !shouldUseCurrentAndroidWindow) {
      void ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE,
      ).catch(() => {
        if (isActive) {
          onFullscreenChangeRef.current?.(false);
        }
      });
    }

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'background') {
          onFullscreenChangeRef.current?.(false);
        }
      },
    );

    return () => {
      isActive = false;
      appStateSubscription.remove();
      if (shouldManageOrientation) {
        lockScreenOrientation(
          getDefaultOrientationLock(shouldUseCurrentAndroidWindow),
        );
      }
    };
  }, [isFullscreen]);

  return (
    <>
      {shouldHideStatusBar ? <StatusBar hidden /> : null}
      <TradingViewNativeContainer {...props} />
    </>
  );
}
