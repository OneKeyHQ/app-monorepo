import { EHardwareTransportType } from '../../../types';

import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async ({
  hardwareTransportType,
}: {
  hardwareTransportType?: EHardwareTransportType;
}): Promise<CoreApi> => {
  if (hardwareTransportType === EHardwareTransportType.DesktopWebBle) {
    return (await import('@onekeyfe/hd-common-connect-sdk')).default;
  }
  return (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKTopLevel as unknown as Promise<CoreApi>;
};

export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
