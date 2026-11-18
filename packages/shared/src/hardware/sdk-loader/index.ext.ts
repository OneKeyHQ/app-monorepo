import { OneKeyLocalError } from '../../errors';

import type { EHardwareTransportType } from '../../../types';
import type {
  CoreApi,
  LowLevelCoreApi,
  UsbDeviceIdentity,
} from '@onekeyfe/hd-core';

export const probeUsbDeviceIdentities = async (params: {
  commType: UsbDeviceIdentity['commType'];
}): Promise<UsbDeviceIdentity[]> =>
  (await import('@onekeyfe/hd-common-connect-sdk')).probeUsbDeviceIdentities(
    params,
  );

// Extension UI only grants USB access. The background loader owns the RPC facade.
export const importHardwareSDK = async (_params: {
  hardwareTransportType?: EHardwareTransportType;
}): Promise<CoreApi> => {
  throw new OneKeyLocalError(
    'Hardware SDK is only available in the extension background',
  );
};

export const importHardwareSDKLowLevel = async (
  _hardwareTransportType?: EHardwareTransportType,
): Promise<LowLevelCoreApi> => {
  throw new OneKeyLocalError(
    'Hardware SDK is only available in the extension background',
  );
};
