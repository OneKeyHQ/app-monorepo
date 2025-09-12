import { useEffect, useState } from 'react';

import * as ScreenOrientation from 'expo-screen-orientation';
import { Dimensions } from 'react-native';
import { useMedia } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useOrientation = () => {
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
};

export const useIsIpadLandscape = platformEnv.isNativeIOSPad
  ? () => {
      const isLandscape = useOrientation();
      return isLandscape;
    }
  : () => false;

export const useIsHorizontalLayout = () => {
  const { gtMd } = useMedia();
  const isLandscape = useIsIpadLandscape();
  return (
    !platformEnv.isNativeAndroid &&
    ((!platformEnv.isNative && gtMd) || isLandscape)
  );
};
