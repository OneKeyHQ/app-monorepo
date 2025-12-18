import { useEffect, useState } from 'react';

import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

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
    const listenerId = ReactNativeDeviceUtils.addSpanningChangedListener(
      (result) => {
        setIsSpanningInDualScreen(result);
      },
    );
    return () => {
      ReactNativeDeviceUtils.removeSpanningChangedListener(listenerId);
    };
  }, []);
  return isSpanningInDualScreen;
};
