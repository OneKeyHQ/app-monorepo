import { EHardwareTransportType } from '../../../types';

import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async ({
  hardwareTransportType,
}: {
  hardwareTransportType?: EHardwareTransportType;
}): Promise<CoreApi> => {
  // Use hd-common-connect-sdk for both DesktopWebBle and WEBUSB
  // This allows direct WebUSB connection without needing bridge
  if (
    hardwareTransportType === EHardwareTransportType.DesktopWebBle ||
    hardwareTransportType === EHardwareTransportType.WEBUSB
  ) {
    return (await import('@onekeyfe/hd-common-connect-sdk')).default;
  }
  return (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKTopLevel as unknown as Promise<CoreApi>;
};

export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
