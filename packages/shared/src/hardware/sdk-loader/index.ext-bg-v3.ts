import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async () => {
  const sdkLib = await import('@onekeyfe/hd-web-sdk');
  const sdk =
    // @ts-ignore
    (sdkLib.HardwareSDKTopLevel as CoreApi) ||
    sdkLib.default.HardwareSDKTopLevel;
  return sdk;
};

// background ---> offscreen (hardware method call)
//    background: -> sdkLowLevel -> offscreenApiProxy -> OffscreenApiProxyBase.callRemoteApi -> bridgeExtBg.requestToOffscreen
//    offscreen: -> offscreenSetup -> receiveHandler -> offscreenApi.callOffscreenApiMethod -> offscreenApi

// offscreen ---> background (hardware events emit)
//    offscreenApi -> addHardwareGlobalEventListener -> extJsBridgeOffscreenToBg.request -> serviceHardware.passHardwareEventsFromOffscreenToBackground
export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy'))
    .default.hardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
