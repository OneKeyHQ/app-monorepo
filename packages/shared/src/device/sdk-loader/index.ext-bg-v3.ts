import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async () => {
  const sdkLib = await import('@onekeyfe/hd-web-sdk');
  const sdk =
    // @ts-ignore
    (sdkLib.HardwareWebSdk as CoreApi) || sdkLib.default.HardwareWebSdk;
  return sdk;
};

export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy'))
    .default.hardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
