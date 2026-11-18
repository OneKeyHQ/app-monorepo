import { EHardwareTransportType } from '../../../types';
import { CoreSDKLoader } from '../coreSdkLoader';

import type {
  CoreApi,
  LowLevelCoreApi,
  UsbDeviceIdentity,
} from '@onekeyfe/hd-core';

export const probeUsbDeviceIdentities = (_params: {
  commType: UsbDeviceIdentity['commType'];
}): Promise<UsbDeviceIdentity[]> => Promise.resolve([]);

export const importHardwareSDK = async ({
  hardwareTransportType: _hardwareTransportType,
}: {
  hardwareTransportType?: EHardwareTransportType;
}): Promise<CoreApi> => {
  const { HardwareTopLevelSdk } = await CoreSDKLoader();
  return HardwareTopLevelSdk();
};

// background ---> offscreen (hardware method call)
//    background: -> sdkLowLevel -> offscreenApiProxy -> OffscreenApiProxyBase.callRemoteApi -> bridgeExtBg.requestToOffscreen
//    offscreen: -> offscreenSetup -> receiveHandler -> offscreenApi.callOffscreenApiMethod -> offscreenApi

// offscreen ---> background (hardware events emit)
//    offscreenApi -> addHardwareGlobalEventListener -> extJsBridgeOffscreenToBg.request -> serviceHardware.passHardwareEventsFromOffscreenToBackground
export const importHardwareSDKLowLevel = async (
  hardwareTransportType?: EHardwareTransportType,
): Promise<LowLevelCoreApi> => {
  const { default: offscreenApiProxy } =
    await import('@onekeyhq/kit-bg/src/offscreens/instance/offscreenApiProxy');
  const isDirectTransport =
    hardwareTransportType === EHardwareTransportType.WEBUSB ||
    hardwareTransportType === EHardwareTransportType.DesktopWebBle;
  return isDirectTransport
    ? offscreenApiProxy.hardwareSDKLowLevel
    : offscreenApiProxy.hardwareSDKBridgeLowLevel;
};
