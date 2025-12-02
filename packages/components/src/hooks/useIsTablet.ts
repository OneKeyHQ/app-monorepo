import * as ExpoDevice from 'expo-device';

import { useDualScreenInfo } from '@onekeyhq/shared/src/modules/DualScreenInfo';

export const useIsTablet = () => {
  const { isDualScreenDevice } = useDualScreenInfo();
  return (
    isDualScreenDevice || ExpoDevice.deviceType === ExpoDevice.DeviceType.TABLET
  );
};
