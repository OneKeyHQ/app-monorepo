import { uniq } from 'lodash';

import type { IDesktopSystemInfo } from '@onekeyhq/desktop/app/config';

import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';

import { getExpoDeviceResult } from './utils/expoDevice';
import { getUAParserResult } from './utils/uaParser';

import type { IAppDeviceInfo, IAppDeviceInfoData } from './types';

let appDeviceInfoData: IAppDeviceInfoData | undefined;

const appDeviceInfo: IAppDeviceInfo = {
  getDeviceInfo: async () => {
    if (appDeviceInfoData) {
      return appDeviceInfoData;
    }

    const uaResult = await getUAParserResult();
    const ExpoDevice = getExpoDeviceResult();
    let desktopSystemInfo: IDesktopSystemInfo | undefined;
    if (platformEnv.isDesktop) {
      desktopSystemInfo =
        await globalThis.desktopApiProxy?.system?.getSystemInfo();
    }

    let deviceModel: string | undefined =
      desktopSystemInfo?.system.model ||
      uaResult.device.model ||
      ExpoDevice.modelName ||
      ExpoDevice.modelId ||
      undefined;
    if (
      desktopSystemInfo?.os?.distro === 'macOS' &&
      desktopSystemInfo?.system.version
    ) {
      deviceModel = desktopSystemInfo?.system.version;
    }
    appDeviceInfoData = {
      displayName: '',
      device: {
        type: uaResult.device.type || ExpoDevice.appDeviceType,
        vendor:
          desktopSystemInfo?.system.manufacturer ||
          uaResult.device.vendor ||
          ExpoDevice.manufacturer ||
          ExpoDevice.brand ||
          undefined, // vendor: "Apple"
        model: deviceModel, // model: "Macintosh"
        name: ExpoDevice.deviceName || deviceModel, // name: "Macintosh"
      },
      os: {
        name:
          desktopSystemInfo?.os?.distro ||
          ExpoDevice.osName ||
          uaResult.os.name, // "macOS"
        version:
          desktopSystemInfo?.os.release ||
          ExpoDevice.osVersion ||
          uaResult.os.version, // "15.4.1"
      },
      cpu: {
        architecture: uniq([
          ...(ExpoDevice.supportedCpuArchitectures || []),
          uaResult.cpu.architecture,
          desktopSystemInfo?.os.arch,
        ]).filter(Boolean), // "architecture": "arm64"
      },
      browser: {
        name: uaResult.browser.name, // "name": "Chrome",
        version: uaResult.browser.version, // "version": "136.0.7103.93",
        versionMajor: uaResult.browser.major, // "major": "136"
        type: uaResult.browser.type,
        engine: uaResult.engine.name, // "name": "Blink",
        engineVersion: uaResult.engine.version, // "version": "136.0.7103.93"
        ua: uaResult.ua,
      },
    };
    if (process.env.NODE_ENV !== 'production') {
      // TODO get system info from sentry
      appDeviceInfoData.$desktopSystemInfo = desktopSystemInfo;
      appDeviceInfoData.$expoDevice = ExpoDevice;
      appDeviceInfoData.$uaParser = uaResult;
    }

    if (platformEnv.isDesktop) {
      appDeviceInfoData.displayName =
        appDeviceInfoData?.device?.model || appDeviceInfoData?.device?.name;
    } else {
      appDeviceInfoData.displayName = [
        ExpoDevice.osName || appDeviceInfoData.os.name,
        appDeviceInfoData.browser.name,
        appDeviceInfoData.browser.version ||
          appDeviceInfoData.browser.versionMajor,
      ]
        .filter(Boolean)
        .join(' ');
    }
    return appDeviceInfoData;
  },
};

if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$appDeviceInfo = appDeviceInfo;
}

export default appDeviceInfo;
