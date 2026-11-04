import type { CoreApi, UsbDeviceIdentity } from '@onekeyfe/hd-core';

export const probeUsbDeviceIdentities = (_params: {
  commType: UsbDeviceIdentity['commType'];
}): Promise<UsbDeviceIdentity[]> => Promise.resolve([]);

export const importHardwareSDK = async () =>
  (await import('@onekeyfe/hd-ble-sdk')).default as unknown as Promise<CoreApi>;

export const importHardwareSDKLowLevel = async () => Promise.resolve(undefined);
