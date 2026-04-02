import type { EHardwareTransportType } from '../../../types';
import type { CoreApi, LowLevelCoreApi } from '@onekeyfe/hd-core';

export const importHardwareSDK = async ({
  hardwareTransportType: _hardwareTransportType,
}: {
  hardwareTransportType?: EHardwareTransportType;
}): Promise<CoreApi> => {
  // TODO: remove this
  // if (hardwareTransportType === EHardwareTransportType.WEBUSB) {
  //   return (await import('@onekeyfe/hd-common-connect-sdk')).default;
  // }

  const sdkLib = await import('@onekeyfe/hd-web-sdk');
  return (
    // @ts-expect-error
    (sdkLib.HardwareSDKTopLevel as CoreApi) ||
    sdkLib.default.HardwareSDKTopLevel
  );
};

// background ---> offscreen (hardware method call)
//    background: -> sdkLowLevel -> offscreenApiProxy -> OffscreenApiProxyBase.callRemoteApi -> bridgeExtBg.requestToOffscreen
//    offscreen: -> offscreenSetup -> receiveHandler -> offscreenApi.callOffscreenApiMethod -> offscreenApi

// offscreen ---> background (hardware events emit)
//    offscreenApi -> addHardwareGlobalEventListener -> extJsBridgeOffscreenToBg.request -> serviceHardware.passHardwareEventsFromOffscreenToBackground
export const importHardwareSDKLowLevel = async () =>
  (await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy'))
    .default.hardwareSDKLowLevel as unknown as Promise<LowLevelCoreApi>;
