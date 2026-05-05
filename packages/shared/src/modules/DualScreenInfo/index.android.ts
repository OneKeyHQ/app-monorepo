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

const getDualScreenInfoWidth = () => {
  const { width: windowWidth } = Dimensions.get('window');
  const { width: screenWidth } = Dimensions.get('screen');
  const spanning = isSpanning();
  if (spanning) {
    return Math.max(windowWidth, screenWidth) / 2;
  }
  return Math.min(windowWidth, screenWidth);
};

export const useDualScreenWidth = () => {
  const [width, setWidth] = useState(() => getDualScreenInfoWidth());
  useEffect(() => {
    const windowListener = Dimensions.addEventListener('change', () => {
      setWidth(getDualScreenInfoWidth());
    });
    return () => {
      windowListener?.remove();
    };
  }, []);
  return width;
};
