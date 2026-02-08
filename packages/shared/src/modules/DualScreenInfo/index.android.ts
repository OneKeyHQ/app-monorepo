import { useEffect, useState } from 'react';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import * as ExpoDevice from 'expo-device';
import { Dimensions } from 'react-native';

import { defaultLogger } from '../../logger/logger';

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
  let result: number;
  if (spanning) {
    result = Math.max(windowWidth, screenWidth) / 2;
  } else {
    result = Math.min(windowWidth, screenWidth);
  }
  defaultLogger.app.page.getDualScreenInfoWidth({
    windowWidth,
    screenWidth,
    isDualScreen: isDualScreenDevice(),
    isSpanning: spanning,
    isRawSpanning: isRawSpanning(),
    result,
  });
  return result;
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
