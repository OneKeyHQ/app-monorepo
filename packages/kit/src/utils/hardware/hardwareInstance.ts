import { ConnectSettings, CoreApi } from '@onekeyfe/hd-core';

import { HARDWARE_SDK_IFRAME_SRC } from '@onekeyhq/kit/src/config';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;
let initialized = false;

// eslint-disable-next-line no-async-promise-executor
const promise: Promise<CoreApi> = new Promise(async (resolve) => {
  if (initialized) {
    resolve(HardwareSDK);
    return;
  }

  const settings: Partial<ConnectSettings> = {
    debug: true,
  };

  if (platformEnv.isNative) {
    HardwareSDK = (await import('@onekeyfe/hd-ble-sdk'))
      .default as unknown as CoreApi;
  } else {
    HardwareSDK = (await import('@onekeyfe/hd-web-sdk'))
      .default as unknown as CoreApi;
    settings.connectSrc = HARDWARE_SDK_IFRAME_SRC;
  }

  try {
    await HardwareSDK.init(settings);
    initialized = true;
    resolve(HardwareSDK);
  } catch {
    return null;
  }
});

export const getHardwareSDKInstance = async () => {
  const SDK = await promise;
  return SDK;
};

export { HardwareSDK };
