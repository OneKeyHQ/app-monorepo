import { useEffect, useState } from 'react';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import * as ExpoDevice from 'expo-device';
import { Dimensions } from 'react-native';

let isDualScreen: boolean | undefined;
export const isDualScreenDevice = () => {
  if (isDualScreen === undefined) {
    isDualScreen = ReactNativeDeviceUtils.isDualScreenDevice();
  }
  return isDualScreen;
};

const MIN_TABLET_ASPECT_RATIO = 1.6;

const isTabletScreen = () => {
  if (ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET) {
    return true;
  }
  const { width, height } = Dimensions.get('window');
  const realHeight = Math.max(width, height);
  const realWidth = Math.min(width, height);
  const aspectRatio = realHeight / realWidth;
  return aspectRatio < MIN_TABLET_ASPECT_RATIO;
};

export const isRawSpanning = () => {
  return ReactNativeDeviceUtils.isSpanning();
};

export const isSpanning = () => {
  return isRawSpanning() && isTabletScreen();
};

export const useIsSpanningInDualScreen = () => {
  const [isSpanningInDualScreen, setIsSpanningInDualScreen] = useState(() => {
    const spanning = isSpanning();
    return spanning;
  });
  useEffect(() => {
    if (!isDualScreenDevice()) {
      return;
    }
    const windowListener = Dimensions.addEventListener('change', () => {
      setIsSpanningInDualScreen(isSpanning() && isTabletScreen());
    });
    return () => {
      windowListener?.remove();
    };
  }, []);
  return isSpanningInDualScreen;
};

// When the user opts out of the split-view layout (settingsPersistAtom.enableSplitView === false),
// a spanning dual-screen device should be treated as one continuous logical pane
// instead of two halves. The setting lives in kit-bg, which shared cannot import,
// so kit calls `setSplitViewLayoutDisabled` from <Container> at startup.
let splitViewLayoutDisabled = false;
const splitViewLayoutListeners = new Set<() => void>();

export function setSplitViewLayoutDisabled(disabled: boolean) {
  if (splitViewLayoutDisabled === disabled) return;
  splitViewLayoutDisabled = disabled;
  splitViewLayoutListeners.forEach((fn) => fn());
}

const getDualScreenInfoWidth = () => {
  const { width: windowWidth } = Dimensions.get('window');
  const { width: screenWidth } = Dimensions.get('screen');
  const spanning = isSpanning();
  if (spanning) {
    // Single-pane override: app renders as one logical surface across the
    // unfolded screen, so don't halve the width.
    if (splitViewLayoutDisabled) {
      return Math.max(windowWidth, screenWidth);
    }
    return Math.max(windowWidth, screenWidth) / 2;
  }
  return Math.min(windowWidth, screenWidth);
};

export const useDualScreenWidth = () => {
  const [width, setWidth] = useState(() => getDualScreenInfoWidth());
  useEffect(() => {
    const update = () => setWidth(getDualScreenInfoWidth());
    const windowListener = Dimensions.addEventListener('change', update);
    splitViewLayoutListeners.add(update);
    return () => {
      windowListener?.remove();
      splitViewLayoutListeners.delete(update);
    };
  }, []);
  return width;
};

export const useIsSplitViewLayoutDisabled = () => {
  const [disabled, setDisabled] = useState(splitViewLayoutDisabled);
  useEffect(() => {
    const update = () => setDisabled(splitViewLayoutDisabled);
    splitViewLayoutListeners.add(update);
    return () => {
      splitViewLayoutListeners.delete(update);
    };
  }, []);
  return disabled;
};
