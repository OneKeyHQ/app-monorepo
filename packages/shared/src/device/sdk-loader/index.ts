import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async () =>
  (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareWebSdk as unknown as Promise<CoreApi>;

export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyfe/hd-web-sdk')).default
    .HardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
