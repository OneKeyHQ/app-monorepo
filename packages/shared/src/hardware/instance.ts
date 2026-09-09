import {
  HARDWARE_SDK_IFRAME_SRC_ONEKEYSO,
  HARDWARE_SDK_VERSION,
} from '@onekeyhq/shared/src/config/appConfig';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { EHardwareTransportType } from '../../types';
import { OneKeyLocalError } from '../errors';

import { importHardwareSDK, importHardwareSDKLowLevel } from './sdk-loader';

import type { EOnekeyDomain } from '../../types';
import type {
  ConnectSettings,
  CoreApi,
  LowLevelCoreApi,
  RemoteConfigResponse,
} from '@onekeyfe/hd-core';

// eslint-disable-next-line import/no-mutable-exports
let HardwareSDK: CoreApi;
let HardwareLowLevelSDK: LowLevelCoreApi;

export const generateConnectSrc = () => {
  const connectSrc = `${HARDWARE_SDK_IFRAME_SRC_ONEKEYSO}/${HARDWARE_SDK_VERSION}/`;
  return connectSrc;
};

export const isDirectFirmwareHostBindingTransport = (
  hardwareTransportType?: EHardwareTransportType,
): boolean =>
  Boolean(
    platformEnv.isNative ||
    (platformEnv.isDesktop &&
      (hardwareTransportType === EHardwareTransportType.WEBUSB ||
        hardwareTransportType === EHardwareTransportType.DesktopWebBle)),
  );

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
        await HardwareSDK.dispose();
      }

      if (HardwareLowLevelSDK) {
        if (typeof HardwareLowLevelSDK.removeAllListeners === 'function') {
          // @ts-expect-error
          HardwareLowLevelSDK.removeAllListeners();
        }
        if (typeof HardwareLowLevelSDK.dispose === 'function') {
          await HardwareLowLevelSDK.dispose();
        }
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
  loadFirmwareConfig?: () => Promise<RemoteConfigResponse | undefined>;
}): Promise<CoreApi> => {
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

  const isAppManagedManifest = Boolean(
    platformEnv.isNative || platformEnv.isDesktop,
  );
  const settings: Partial<ConnectSettings> & {
    protocolV2DeviceInfoMockEnabled?: boolean;
  } = {
    debug: params.debugMode,
    env,
    protocolV2DeviceInfoMockEnabled: false,
  };
  if (isAppManagedManifest) {
    if (!params.loadFirmwareConfig) {
      throw new OneKeyLocalError(
        'App-managed firmware config loader is required',
      );
    }
    settings.fetchConfig = false;
    settings.firmwareManifestMode = 'external-only';
    const firmwareConfig = await params.loadFirmwareConfig();
    if (firmwareConfig) {
      settings.preloadedConfig = firmwareConfig;
    }
  } else {
    settings.fetchConfig = true;
    settings.firmwareManifestMode = 'sdk-managed';
  }

  try {
    HardwareSDK = await importHardwareSDK({
      hardwareTransportType: params.hardwareTransportType,
    });

    if (!platformEnv.isNative) {
      let connectSrc = generateConnectSrc();
      if (platformEnv.isDesktop) {
        const desktopGlobals =
          globalThis.ONEKEY_DESKTOP_GLOBALS_GETTER?.() ??
          globalThis.ONEKEY_DESKTOP_GLOBALS;
        const { sdkConnectSrc } = desktopGlobals ?? {};
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

    const initialized = await HardwareSDK.init(settings, HardwareLowLevelSDK);
    if (initialized === false) {
      throw new OneKeyLocalError('HardwareSDK initialization failed');
    }
    console.log('HardwareSDK initialized success');
    return HardwareSDK;
  } catch (error) {
    await cleanupHardwareSDKInstance();
    throw error;
  }
};

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
