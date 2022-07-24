import { LOG_EVENT } from '@onekeyfe/hd-core';
import memoizee from 'memoizee';

import {
  HARDWARE_SDK_IFRAME_SRC,
  HARDWARE_SDK_TEST_IFRAME_SRC,
} from '@onekeyhq/kit/src/config';
import store from '@onekeyhq/kit/src/store';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ConnectSettings, CoreApi, CoreMessage } from '@onekeyfe/hd-core';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;
let initialized = false;

export const getHardwareSDKInstance = memoizee(
  async () =>
    // eslint-disable-next-line no-async-promise-executor
    new Promise<CoreApi>(async (resolve, reject) => {
      if (initialized) {
        resolve(HardwareSDK);
        return;
      }

      const settings: Partial<ConnectSettings> = {
        debug: !!platformEnv.isNative,
      };

      if (platformEnv.isNative) {
        HardwareSDK = (await import('@onekeyfe/hd-ble-sdk'))
          .default as unknown as CoreApi;
      } else {
        HardwareSDK = (await import('@onekeyfe/hd-web-sdk'))
          .default as unknown as CoreApi;
        const devMode = store.getState()?.settings?.devMode?.enable ?? false;
        settings.connectSrc = devMode
          ? HARDWARE_SDK_TEST_IFRAME_SRC
          : HARDWARE_SDK_IFRAME_SRC;
      }

      try {
        HardwareSDK.on(LOG_EVENT, (messages: CoreMessage) => {
          if (Array.isArray(messages?.payload)) {
            debugLogger.hardwareSDK.info(messages.payload.join(' '));
          }
        });
        await HardwareSDK.init(settings);
        debugLogger.hardwareSDK.info('HardwareSDK initialized success');
        initialized = true;
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
