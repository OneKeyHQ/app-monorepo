import { useEffect, useState } from 'react';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';
import { Dimensions } from 'react-native';

let isDualScreen: boolean | undefined;
export const isDualScreenDevice = () => {
  if (isDualScreen === undefined) {
    isDualScreen = ReactNativeDeviceUtils.isDualScreenDevice();
  }
  return isDualScreen;
};

export const isSpanning = () => {
  return ReactNativeDeviceUtils.isSpanning();
};

export const useIsSpanningInDualScreen = () => {
  const [isSpanningInDualScreen, setIsSpanningInDualScreen] = useState(
    ReactNativeDeviceUtils.isSpanning(),
  );
  useEffect(() => {
    if (!isDualScreenDevice()) {
      return;
    }
    const listenerId = ReactNativeDeviceUtils.addSpanningChangedListener(
      (result) => {
        const screenWidth = Dimensions.get('window').width;
        setIsSpanningInDualScreen(result && screenWidth > 800);
      },
    );
    return () => {
      ReactNativeDeviceUtils.removeSpanningChangedListener(listenerId);
    };
  }, []);
  return isSpanningInDualScreen;
};
