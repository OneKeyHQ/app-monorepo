import { ConnectSettings, CoreApi } from '@onekeyfe/hd-core';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;

export const getHardwareSDKInstance = (): Promise<CoreApi> =>
  // eslint-disable-next-line no-async-promise-executor
  new Promise(async (resolve) => {
    if (HardwareSDK) {
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
      settings.connectSrc = 'https://localhost:8088/';
    }

    try {
      await HardwareSDK.init(settings);
    } catch {
      return null;
    }

    /**
     *  TODO: mock the handshake process
     * 	important: init must be returned after the handshake
     *
     */
    setTimeout(() => resolve(HardwareSDK), 3000);
  });

export { HardwareSDK };
