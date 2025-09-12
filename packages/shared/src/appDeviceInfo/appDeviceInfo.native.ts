import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';

import { getExpoDeviceResult } from './utils/expoDevice';
import { getUAParserResult } from './utils/uaParser';

import type {
  IAppDeviceInfo,
  IAppDeviceInfoData,
  ICPUArchitecture,
} from './types';

let appDeviceInfoData: IAppDeviceInfoData | undefined;

const appDeviceInfo: IAppDeviceInfo = {
  getDeviceInfo: async () => {
    if (appDeviceInfoData) {
      return appDeviceInfoData;
    }
    const ExpoDevice = getExpoDeviceResult();
    appDeviceInfoData = {
      displayName: '',
      device: {
        type: ExpoDevice.appDeviceType,
        vendor: (ExpoDevice.manufacturer || ExpoDevice.brand) ?? undefined,
        model: (ExpoDevice.modelName || ExpoDevice.modelId) ?? undefined,
        name: ExpoDevice.deviceName ?? undefined,
      },
      os: {
        name: ExpoDevice.osName ?? undefined,
        version: ExpoDevice.osVersion ?? undefined,
      },
      cpu: {
        architecture: (ExpoDevice.supportedCpuArchitectures ?? undefined) as
          | ICPUArchitecture[]
          | undefined,
      },
      browser: {
        name: undefined,
        version: undefined,
        versionMajor: undefined,
        type: undefined,
        engine: undefined,
        engineVersion: undefined,
        ua: undefined,
      },
    };
    if (process.env.NODE_ENV !== 'production') {
      const uaResult = await getUAParserResult();
      appDeviceInfoData.$expoDevice = ExpoDevice;
      appDeviceInfoData.$uaParser = uaResult;
      appDeviceInfoData.$ua = navigator.userAgent || '';
    }

    appDeviceInfoData.displayName =
      appDeviceInfoData.device.name ||
      appDeviceInfoData.device.model ||
      appDeviceInfoData.os.name ||
      appDeviceInfoData.device.vendor;
    // iOS use modelName first
    if (platformEnv.isNativeIOS && appDeviceInfoData.device.model) {
      appDeviceInfoData.displayName = appDeviceInfoData.device.model;
    }
    return appDeviceInfoData;
  },
};

if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$appDeviceInfo = appDeviceInfo;
}

export default appDeviceInfo;
