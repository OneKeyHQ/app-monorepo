import type { EHardwareTransportType } from '../../../types';
import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async ({
  hardwareTransportType: _hardwareTransportType,
}: {
  hardwareTransportType?: EHardwareTransportType;
}): Promise<CoreApi> =>
  // TODO: remove this
  // if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
  //   return (await import('@onekeyfe/hd-common-connect-sdk')).default;
  // }
  (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKTopLevel as unknown as Promise<CoreApi>;

export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
