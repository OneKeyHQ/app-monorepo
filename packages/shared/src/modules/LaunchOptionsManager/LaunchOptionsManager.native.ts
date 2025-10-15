import { NativeModules } from 'react-native';

import platformEnv from '../../platformEnv';

import type { ILaunchOptionsManagerInterface } from './type';

const { LaunchOptionsManager } = NativeModules as {
  LaunchOptionsManager: ILaunchOptionsManagerInterface;
};

const getStartupTimeAt = async () => {
  if (LaunchOptionsManager && LaunchOptionsManager.getStartupTime) {
    const startupTime = await LaunchOptionsManager.getStartupTime();
    return Math.round(
      platformEnv.isNativeIOS ? startupTime * 1000 : startupTime,
    );
  }
  return Promise.resolve(0);
};

const getJSReadyTimeAt = () => {
  return globalThis.$$onekeyJsReadyAt || 0;
};

const getUIVisibleTimeAt = () => {
  return globalThis.$$onekeyUIVisibleAt || 0;
};

const LaunchOptionsManagerModule: ILaunchOptionsManagerInterface = {
  getLaunchOptions: () => {
    if (LaunchOptionsManager && LaunchOptionsManager.getLaunchOptions) {
      return LaunchOptionsManager.getLaunchOptions();
    }
    return Promise.resolve(null);
  },
  clearLaunchOptions: () => {
    if (LaunchOptionsManager && LaunchOptionsManager.clearLaunchOptions) {
      return LaunchOptionsManager.clearLaunchOptions();
    }
    return Promise.resolve(true);
  },
  getDeviceToken: () => {
    if (LaunchOptionsManager && LaunchOptionsManager.getDeviceToken) {
      return LaunchOptionsManager.getDeviceToken();
    }
    return Promise.resolve(null);
  },
  getStartupTime: getStartupTimeAt,
  getStartupTimeAt,
  getJSReadyTimeAt: () => {
    return Promise.resolve(getJSReadyTimeAt());
  },
  getUIVisibleTimeAt: () => {
    return Promise.resolve(getUIVisibleTimeAt());
  },
  getJSReadyTime: async () => {
    const jsReadyAt = getJSReadyTimeAt();
    const startupAt = await getStartupTimeAt();
    return jsReadyAt && startupAt
      ? Promise.resolve(jsReadyAt - startupAt)
      : Promise.resolve(0);
  },
  getUIVisibleTime: async () => {
    const startupAt = await getStartupTimeAt();
    const uiVisibleAt = getUIVisibleTimeAt();
    return startupAt && uiVisibleAt
      ? Promise.resolve(uiVisibleAt - startupAt)
      : Promise.resolve(0);
  },
  getBundleStartTime: () => {
    return Promise.resolve(Math.round(__BUNDLE_START_TIME__ || 0));
  },
  getJsReadyFromPerformanceNow: () => {
    return Promise.resolve(
      Math.round(
        (globalThis.$$onekeyJsReadyFromPerformanceNow || 0) -
          __BUNDLE_START_TIME__,
      ),
    );
  },
  getUIVisibleFromPerformanceNow: () => {
    return Promise.resolve(
      Math.round(
        (globalThis.$$onekeyUIVisibleFromPerformanceNow || 0) -
          __BUNDLE_START_TIME__,
      ),
    );
  },
};

export default LaunchOptionsManagerModule;
