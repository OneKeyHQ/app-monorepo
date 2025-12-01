import * as ExpoDevice from 'expo-device';
import { useMedia } from 'tamagui';

import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useOrientation } from './useOrientation';

export const useIsTablet = () => {
  const { isDualScreenDevice } = useDualScreenInfo();
  return (
    isDualScreenDevice || ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET
  );
};

export const useIsGtMd = () => {
  const { gtMd } = useMedia();
  const isLandscape = useOrientation();
  return platformEnv.isNative && isLandscape ? false : gtMd;
};
