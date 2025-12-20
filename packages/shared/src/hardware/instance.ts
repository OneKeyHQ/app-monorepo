import {
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
  HARDWARE_SDK_VERSION,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { EHardwareTransportType } from '../../types';

import { createConfigFetcher } from './configFetcher';
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

export const generateConnectSrc = () => {
  const connectSrc = `${HARDWARE_SDK_IFRAME_SRC_ONEKEYSO}/${HARDWARE_SDK_VERSION}/`;
  return connectSrc;
};

// Clean up current SDK instance and its event listeners
export const cleanupHardwareSDKInstance = async (): Promise<void> => {
  if (HardwareSDK) {
    try {
      // Remove all event listeners
      if (typeof HardwareSDK.removeAllListeners === 'function') {
        // @ts-expect-error
        HardwareSDK.removeAllListeners();
      }

      // Dispose SDK instance
      if (typeof HardwareSDK.dispose === 'function') {
        HardwareSDK.dispose();
      }

      // Clear SDK references
      HardwareSDK = undefined as any;
      HardwareLowLevelSDK = undefined as any;

      console.log('HardwareSDK instance cleaned up');
    } catch (error) {
      console.error('Error cleaning up HardwareSDK instance:', error);
    }
  }
};

const createHardwareSDKInstance = async (params: {
  isPreRelease: boolean;
  hardwareConnectSrc?: EOnekeyDomain;
  debugMode?: boolean;
  hardwareTransportType?: EHardwareTransportType;
}) =>
  // eslint-disable-next-line no-async-promise-executor
  new Promise<CoreApi>(async (resolve, reject) => {
    // Clean up previous instance if exists
    if (HardwareSDK) {
      await cleanupHardwareSDKInstance();
    }

    let env: undefined | ConnectSettings['env'];
    if (params.hardwareTransportType === EHardwareTransportType.WEBUSB) {
      // Desktop WebUSB doesn't need browser permission prompt
      env = platformEnv.isDesktop ? 'desktop-webusb' : 'webusb';
    } else if (
      params.hardwareTransportType === EHardwareTransportType.DesktopWebBle
    ) {
      env = 'desktop-web-ble' as const;
    }

    const configFetcher = await createConfigFetcher();

    const settings: Partial<ConnectSettings> = {
      debug: params.debugMode,
      fetchConfig: true,
      env,
      configFetcher,
    };

    HardwareSDK = await importHardwareSDK({
      hardwareTransportType: params.hardwareTransportType,
    });

    if (!platformEnv.isNative) {
      let connectSrc = generateConnectSrc();
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
  });

export const getHardwareSDKInstance = memoizee(createHardwareSDKInstance, {
  promise: true,
  max: 1,
});

// Reset SDK instance by clearing memoizee cache and cleaning up
export const resetHardwareSDKInstance = async (): Promise<void> => {
  // Clear memoizee cache
  getHardwareSDKInstance.clear();

  // Clean up current instance
  await cleanupHardwareSDKInstance();

  console.log('HardwareSDK instance reset completed');
};

export const CoreSDKLoader = async () => import('@onekeyfe/hd-core');

export { HardwareSDK };
