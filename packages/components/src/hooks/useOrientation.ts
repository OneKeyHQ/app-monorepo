import { useEffect, useRef, useState } from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  isDualScreenDevice,
  useIsSpanningInDualScreen,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  createOk60835TabBarLogInstance,
  ok60835TabBarLog,
} from '@onekeyhq/shared/src/utils/debug/ok60835TabBarLog';

export const useIsSplitView = isDualScreenDevice()
  ? (_debugScope?: string) => {
      const isSpanning = useIsSpanningInDualScreen();
      return isSpanning;
    }
  : (debugScope?: string) => {
      const [debugInstanceId] = useState(() =>
        debugScope
          ? createOk60835TabBarLogInstance(`orientation:${debugScope}`)
          : '',
      );
      const [isLandscape, setIsLandscape] = useState(
        Dimensions.get('window').width > Dimensions.get('window').height,
      );
      const isLandscapeRef = useRef(isLandscape);
      useEffect(() => {
        if (debugInstanceId) {
          const windowDimensions = Dimensions.get('window');
          const screenDimensions = Dimensions.get('screen');
          ok60835TabBarLog('orientation-subscribe', {
            instance: debugInstanceId,
            scope: debugScope,
            isLandscape: windowDimensions.width > windowDimensions.height,
            windowWidth: windowDimensions.width,
            windowHeight: windowDimensions.height,
            screenWidth: screenDimensions.width,
            screenHeight: screenDimensions.height,
          });
        }

        const handleOrientationChange = (
          event: ScreenOrientation.OrientationChangeEvent,
        ) => {
          const nextIsLandscape =
            event.orientationInfo.orientation ===
              ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
            event.orientationInfo.orientation ===
              ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
          const windowDimensions = Dimensions.get('window');
          const screenDimensions = Dimensions.get('screen');
          if (debugInstanceId) {
            ok60835TabBarLog('orientation-event', {
              instance: debugInstanceId,
              scope: debugScope,
              orientation: event.orientationInfo.orientation,
              orientationLock: event.orientationLock,
              horizontalSizeClass: event.orientationInfo.horizontalSizeClass,
              verticalSizeClass: event.orientationInfo.verticalSizeClass,
              previousIsLandscape: isLandscapeRef.current,
              nextIsLandscape,
              windowWidth: windowDimensions.width,
              windowHeight: windowDimensions.height,
              screenWidth: screenDimensions.width,
              screenHeight: screenDimensions.height,
            });
          }
          isLandscapeRef.current = nextIsLandscape;
          setIsLandscape(nextIsLandscape);
        };

        const subscription = ScreenOrientation.addOrientationChangeListener(
          handleOrientationChange,
        );
        return () => {
          if (debugInstanceId) {
            ok60835TabBarLog('orientation-unsubscribe', {
              instance: debugInstanceId,
              scope: debugScope,
            });
          }
          ScreenOrientation.removeOrientationChangeListener(subscription);
        };
      }, [debugInstanceId, debugScope]);

      return isLandscape;
    };

export const useIsWebHorizontalLayout = () => {
  const { gtMd } = useMedia();
  return !platformEnv.isNative && gtMd;
};
