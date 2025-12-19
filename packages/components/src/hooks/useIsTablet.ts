import * as ExpoDevice from 'expo-device';
import cache from 'memoizee';

import { isDualScreenDevice } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useIsNativeTablet = cache(() => {
  return (
    platformEnv.isNative &&
    (isDualScreenDevice() ||
      ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET)
  );
});
