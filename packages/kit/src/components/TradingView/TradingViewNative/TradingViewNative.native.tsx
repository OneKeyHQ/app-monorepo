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
  const exitSubscriptionRef = useRef<ScreenOrientation.Subscription | null>(
    null,
  );
  const [isExitOrientationReady, setIsExitOrientationReady] = useState(false);
  const clearExitSubscription = useCallback(() => {
    if (exitSubscriptionRef.current) {
      // This also removes Expo's retained subscription registry entry.
      ScreenOrientation.removeOrientationChangeListener(
        exitSubscriptionRef.current,
      );
      exitSubscriptionRef.current = null;
    }
  }, []);
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
      const wasExiting = exitSubscriptionRef.current !== null;
      clearExitSubscription();
      setIsExitOrientationReady(false);
      if (
        platformEnv.isNativeIOS &&
        !platformEnv.isNativeIOSPad &&
        isFullscreen &&
        !nextFullscreen
      ) {
        const finishRotation = () => {
          if (request !== fullscreenRequestRef.current) return;
          clearExitSubscription();
          portraitRestoredRef.current = true;
          setIsExitOrientationReady(true);
        };
        // lockAsync only submits the request. The orientation event is emitted
        // by UIKit's transition completion; keep the same canvas above the
        // detail until both that event and RN's portrait dimensions arrive.
        exitSubscriptionRef.current =
          ScreenOrientation.addOrientationChangeListener(
            ({ orientationInfo }) => {
              if (
                orientationInfo.orientation ===
                ScreenOrientation.Orientation.PORTRAIT_UP
              ) {
                finishRotation();
              }
            },
          );
        void ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP,
        )
          .then(() => ScreenOrientation.getOrientationAsync())
          .then((orientation) => {
            // An immediate exit can cancel entry before any rotation occurs.
            if (orientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
              finishRotation();
            }
          })
          .catch(() => {
            if (request === fullscreenRequestRef.current) {
              clearExitSubscription();
              onFullscreenChangeRef.current?.(false);
            }
          });
        return;
      }
      if (wasExiting && nextFullscreen) {
        lockScreenOrientation(ScreenOrientation.OrientationLock.LANDSCAPE);
      }
      onFullscreenChangeRef.current?.(nextFullscreen);
    },
    [clearExitSubscription, isFullscreen],
  );
  useLayoutEffect(() => {
    if (isFullscreen && isExitOrientationReady && height >= width) {
      onFullscreenChangeRef.current?.(false);
    }
  }, [height, isExitOrientationReady, isFullscreen, width]);

  useLayoutEffect(() => {
    if (!isFullscreen) {
      return;
    }

    let isActive = true;
    portraitRestoredRef.current = false;
    setIsExitOrientationReady(false);
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
      clearExitSubscription();
      appStateSubscription.remove();
      if (shouldManageOrientation && !portraitRestoredRef.current) {
        lockScreenOrientation(
          getDefaultOrientationLock(shouldUseCurrentAndroidWindow),
        );
      }
    };
  }, [clearExitSubscription, isFullscreen]);

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
