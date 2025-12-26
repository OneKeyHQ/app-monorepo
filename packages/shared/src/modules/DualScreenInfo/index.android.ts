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

const isTabletScreen = () => {
  if (ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET) {
    return true;
  }
  const { width, height } = Dimensions.get('window');
  const realHeight = Math.max(width, height);
  const realWidth = Math.min(width, height);
  const aspectRatio = realWidth / realHeight;
  return aspectRatio < 1.7;
};

export const isSpanning = () => {
  return ReactNativeDeviceUtils.isSpanning() && isTabletScreen();
};

export const useIsSpanningInDualScreen = () => {
  const [isSpanningInDualScreen, setIsSpanningInDualScreen] = useState(
    isSpanning(),
  );
  useEffect(() => {
    if (!isDualScreenDevice()) {
      return;
    }
    const listenerId = ReactNativeDeviceUtils.addSpanningChangedListener(
      (result) => {
        setIsSpanningInDualScreen(result && isTabletScreen());
      },
    );
    return () => {
      ReactNativeDeviceUtils.removeSpanningChangedListener(listenerId);
    };
  }, []);
  return isSpanningInDualScreen;
};
