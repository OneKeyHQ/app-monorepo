import * as ExpoDevice from 'expo-device';

import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsNativeTablet = () => {
  const { isDualScreenDevice } = useDualScreenInfo();
  return (
    platformEnv.isNative &&
    (isDualScreenDevice ||
      ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET)
  );
};
