import {
  HARDWARE_SDK_IFRAME_SRC_ONEKEYCN,
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
  HARDWARE_SDK_VERSION,
} from '@onekeyhq/shared/src/config/appConfig';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { importHardwareSDK, importHardwareSDKLowLevel } from './sdk-loader';

import type {
  ConnectSettings,
  CoreApi,
  LowLevelCoreApi,
} from '@onekeyfe/hd-core';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;
let HardwareLowLevelSDK: LowLevelCoreApi;

export const generateConnectSrc = (hardwareConnectSrc?: string) => {
  let connectSrc = `${HARDWARE_SDK_IFRAME_SRC_ONEKEYSO}/${HARDWARE_SDK_VERSION}/`;
  if (hardwareConnectSrc && hardwareConnectSrc.indexOf('onekeycn.com') > -1) {
    connectSrc = `${HARDWARE_SDK_IFRAME_SRC_ONEKEYCN}/${HARDWARE_SDK_VERSION}/`;
  }
  return connectSrc;
};

export const getHardwareSDKInstance = memoizee(
  async (params: { isPreRelease: boolean; hardwareConnectSrc?: string }) =>
    // eslint-disable-next-line no-async-promise-executor
    new Promise<CoreApi>(async (resolve, reject) => {
      if (HardwareSDK) {
        resolve(HardwareSDK);
        return;
      }

      const settings: Partial<ConnectSettings> = {
        debug: platformEnv.isDev,
      };

      HardwareSDK = await importHardwareSDK();

      if (!platformEnv.isNative) {
        let connectSrc = generateConnectSrc(params.hardwareConnectSrc);
        if (platformEnv.isDesktop) {
          // @ts-expect-error
          const { sdkConnectSrc } = window.ONEKEY_DESKTOP_GLOBALS ?? {};
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

export const CoreSDKLoader = async () => import('@onekeyfe/hd-core');

export { HardwareSDK };
