import { useCallback, useLayoutEffect, useRef, useState } from 'react';

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
  const fullscreenRequestRef = useRef(0);
  const portraitRestoredRef = useRef(false);
  const [isExitingFullscreen, setIsExitingFullscreen] = useState(false);
  useLayoutEffect(() => {
    onFullscreenChangeRef.current = onNativeChartFullscreenChange;
  }, [onNativeChartFullscreenChange]);
  const { height, width } = useWindowDimensions();
  const isAndroid = platformEnv.isNativeAndroid === true;
  const shouldHideStatusBar =
    (platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad && isFullscreen) ||
    shouldHideTradingViewNativeStatusBar({
      height,
      isAndroid,
      isFullscreen,
      isSpanningWindow: isAndroid && isSpanning(),
      width,
    });
  const handleFullscreenChange = useCallback(
    (nextFullscreen: boolean) => {
      fullscreenRequestRef.current += 1;
      const request = fullscreenRequestRef.current;
      if (
        platformEnv.isNativeIOS &&
        !platformEnv.isNativeIOSPad &&
        isFullscreen &&
        !nextFullscreen
      ) {
        // Keep the same window-hosted canvas until RN commits portrait bounds.
        // lockAsync only submits the request; it does not wait for that layout.
        setIsExitingFullscreen(true);
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        ).catch(() => {
          if (request === fullscreenRequestRef.current) {
            onFullscreenChangeRef.current?.(false);
          }
        });
        return;
      }
      if (isExitingFullscreen && nextFullscreen) {
        lockScreenOrientation(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
      setIsExitingFullscreen(false);
      onFullscreenChangeRef.current?.(nextFullscreen);
    },
    [isExitingFullscreen, isFullscreen],
  );
  useLayoutEffect(() => {
    if (isFullscreen && isExitingFullscreen && height >= width) {
      portraitRestoredRef.current = true;
      setIsExitingFullscreen(false);
      onFullscreenChangeRef.current?.(false);
    }
  }, [height, isExitingFullscreen, isFullscreen, width]);

  useLayoutEffect(() => {
    if (!isFullscreen) {
      return;
    }

    let isActive = true;
    portraitRestoredRef.current = false;
    setIsExitingFullscreen(false);
    // Rotate phones through the system while preserving iPad's window policy.
    const shouldManageOrientation =
      platformEnv.isNativeAndroid ||
      (platformEnv.isNativeIOS && !platformEnv.isNativeIOSPad);
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
      fullscreenRequestRef.current += 1;
      appStateSubscription.remove();
      if (shouldManageOrientation && !portraitRestoredRef.current) {
        lockScreenOrientation(
          getDefaultOrientationLock(shouldUseCurrentAndroidWindow),
        );
      }
    };
  }, [isFullscreen]);

  return (
    <>
      {shouldHideStatusBar ? <StatusBar hidden /> : null}
      <TradingViewNativeContainer
        {...props}
        onNativeChartFullscreenChange={handleFullscreenChange}
      />
    </>
  );
}
