import memoizee from 'memoizee';

import { HARDWARE_SDK_IFRAME_SRC } from '@onekeyhq/kit/src/config';
// import store from '@onekeyhq/kit/src/store';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { importHardwareSDK } from './importHardwareSDK';

import type { ConnectSettings, CoreApi } from '@onekeyfe/hd-core';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;

export const getHardwareSDKInstance = memoizee(
  async () =>
    // eslint-disable-next-line no-async-promise-executor
    new Promise<CoreApi>(async (resolve, reject) => {
      if (HardwareSDK) {
        resolve(HardwareSDK);
        return;
      }

      const settings: Partial<ConnectSettings> = {
        // debug: platformEnv.isDev && platformEnv.isNative
        debug: true,
      };

      HardwareSDK = await importHardwareSDK();

      if (!platformEnv.isNative) {
        settings.connectSrc = HARDWARE_SDK_IFRAME_SRC;
      }

      try {
        await HardwareSDK.init(settings);
        debugLogger.hardwareSDK.info('HardwareSDK initialized success');
        resolve(HardwareSDK);
      } catch (e) {
        reject(e);
      }
    }),
  {
    promise: true,
    max: 1,
  },
);

export { HardwareSDK };
