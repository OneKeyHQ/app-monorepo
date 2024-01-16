import type { CoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async () =>
  (await import('@onekeyfe/hd-ble-sdk')).default as unknown as Promise<CoreApi>;

export const importHardwareSDKLowLevel = async () => Promise.resolve(undefined);
