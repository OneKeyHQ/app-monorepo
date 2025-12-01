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

export const useIsGtMd = platformEnv.isNative
  ? () => {
      const { gtMd } = useMedia();
      const isLandscape = useOrientation();
      return isLandscape ? false : gtMd;
    }
  : () => {
      const { gtMd } = useMedia();
      return gtMd;
    };

export const useIsMd = platformEnv.isNative
  ? () => {
      const { md } = useMedia();
      const isLandscape = useOrientation();
      return isLandscape ? true : md;
    }
  : () => {
      const { md } = useMedia();
      return md;
    };
