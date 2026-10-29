import { useEffect, useState } from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions, useWindowDimensions } from 'react-native';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import {
  isDualScreenDevice,
  useIsSpanningInDualScreen,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Narrowest iPad window that still splits into two panes (iPad Pro 9.7"
// landscape is 1024pt).
const IPAD_SPLIT_VIEW_MIN_WIDTH = 1000;

function useIsIPadWindowSplitView() {
  // iPad windows resize without rotating (Split View, Slide Over, Stage
  // Manager), so follow the window rather than the device orientation.
  const { width, height } = useWindowDimensions();
  return width > height && width >= IPAD_SPLIT_VIEW_MIN_WIDTH;
}

function useIsLandscapeSplitView() {
  const [isLandscape, setIsLandscape] = useState(
    Dimensions.get('window').width > Dimensions.get('window').height,
  );
  useEffect(() => {
    const handleOrientationChange = (
      event: ScreenOrientation.OrientationChangeEvent,
    ) => {
      setIsLandscape(
        event.orientationInfo.orientation ===
          ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
          event.orientationInfo.orientation ===
            ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
      );
    };

    const subscription = ScreenOrientation.addOrientationChangeListener(
      handleOrientationChange,
    );
    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  return isLandscape;
}

function resolveUseIsSplitView(): () => boolean {
  if (isDualScreenDevice()) {
    return () => {
      const isSpanning = useIsSpanningInDualScreen();
      return isSpanning;
    };
  }
  return platformEnv.isNativeIOSPad
    ? useIsIPadWindowSplitView
    : useIsLandscapeSplitView;
}

export const useIsSplitView = resolveUseIsSplitView();

export const useIsWebHorizontalLayout = () => {
  const { gtMd } = useMedia();
  return !platformEnv.isNative && gtMd;
};
