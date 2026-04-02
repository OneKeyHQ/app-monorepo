import { ReactNativeDeviceUtils } from '@onekeyfe/react-native-device-utils';

import platformEnv from '../../platformEnv';

import type { ILaunchOptions, ILaunchOptionsManagerInterface } from './type';

const getStartupTimeAt = async () => {
  const startupTime = await ReactNativeDeviceUtils.getStartupTime();
  return Math.round(platformEnv.isNativeIOS ? startupTime * 1000 : startupTime);
};

const getJSReadyTimeAt = () => {
  return globalThis.$$onekeyJsReadyAt || 0;
};

const getUIVisibleTimeAt = () => {
  return globalThis.$$onekeyUIVisibleAt || 0;
};

const LaunchOptionsManagerModule: ILaunchOptionsManagerInterface = {
  getLaunchOptions: () =>
    ReactNativeDeviceUtils.getLaunchOptions() as Promise<ILaunchOptions | null>,
  clearLaunchOptions: () => ReactNativeDeviceUtils.clearLaunchOptions(),
  getDeviceToken: () => {
    if (!platformEnv.isNativeIOS) {
      return Promise.resolve('');
    }
    return ReactNativeDeviceUtils.getDeviceToken();
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
  registerDeviceToken: () => {
    if (!platformEnv.isNativeIOS) {
      return Promise.resolve(true);
    }
    return ReactNativeDeviceUtils.registerDeviceToken();
  },
};

export default LaunchOptionsManagerModule;
