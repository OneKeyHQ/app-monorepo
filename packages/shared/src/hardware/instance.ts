import {
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
  HARDWARE_SDK_VERSION,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { importHardwareSDK, importHardwareSDKLowLevel } from './sdk-loader';

import type { EOnekeyDomain } from '../../types';
import type {
  ConnectSettings,
  CoreApi,
  LowLevelCoreApi,
} from '@onekeyfe/hd-core';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;
let HardwareLowLevelSDK: LowLevelCoreApi;

export const generateConnectSrc = (hardwareConnectSrc?: EOnekeyDomain) => {
  const connectSrc = `${HARDWARE_SDK_IFRAME_SRC_ONEKEYSO}/${HARDWARE_SDK_VERSION}/`;
  return connectSrc;
};

export const getHardwareSDKInstance = memoizee(
  async (params: {
    isPreRelease: boolean;
    hardwareConnectSrc?: EOnekeyDomain;
    debugMode?: boolean;
  }) =>
    // eslint-disable-next-line no-async-promise-executor
    new Promise<CoreApi>(async (resolve, reject) => {
      if (HardwareSDK) {
        resolve(HardwareSDK); // TODO cache conflict with memoizee?
        return;
      }

      const settings: Partial<ConnectSettings> = {
        debug: params.debugMode,
        fetchConfig: true,
      };

      HardwareSDK = await importHardwareSDK();

      if (!platformEnv.isNative) {
        let connectSrc = generateConnectSrc(params.hardwareConnectSrc);
        if (platformEnv.isDesktop) {
          const { sdkConnectSrc } = globalThis.ONEKEY_DESKTOP_GLOBALS ?? {};
          if (sdkConnectSrc) {
            connectSrc = sdkConnectSrc;
          }
        }
        settings.connectSrc = connectSrc;
        HardwareLowLevelSDK = await importHardwareSDKLowLevel();
        if (platformEnv.isExtensionBackgroundServiceWorker) {
          // addHardwareGlobalEventListener in ext offscreen
        } else {
          HardwareLowLevelSDK?.addHardwareGlobalEventListener((eventParams) => {
            HardwareSDK.emit(eventParams.event, { ...eventParams });
          });
        }
      }

      settings.preRelease = params.isPreRelease;

      try {
        await HardwareSDK.init(settings, HardwareLowLevelSDK);
        // debugLogger.hardwareSDK.info('HardwareSDK initialized success');
        console.log('HardwareSDK initialized success');
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

export const CoreSDKLoader = async () => import('@onekeyfe/hd-core');

export { HardwareSDK };
