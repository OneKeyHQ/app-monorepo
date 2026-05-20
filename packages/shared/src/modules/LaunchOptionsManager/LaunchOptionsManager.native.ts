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
    if (startupAt && jsReadyAt && jsReadyAt > startupAt) {
      return jsReadyAt - startupAt;
    }
    // Fallback: when native startupTime is unavailable, anchor on
    // __BUNDLE_START_TIME__ (same performance.now() base as $$…FromPerformanceNow).
    // Guard __BUNDLE_START_TIME__ with `|| 0` so an undefined anchor (e.g. test
    // harness, bg-thread runtime, partial OTA boot) reports 0 instead of NaN
    // polluting the metric.
    const jsReadyPerf = globalThis.$$onekeyJsReadyFromPerformanceNow || 0;
    const bundleStart = __BUNDLE_START_TIME__ || 0;
    return jsReadyPerf && bundleStart
      ? Math.round(jsReadyPerf - bundleStart)
      : 0;
  },
  getUIVisibleTime: async () => {
    const uiVisibleAt = getUIVisibleTimeAt();
    if (!uiVisibleAt) return 0;
    const startupAt = await getStartupTimeAt();
    if (startupAt && uiVisibleAt > startupAt) {
      return uiVisibleAt - startupAt;
    }
    const uiVisiblePerf = globalThis.$$onekeyUIVisibleFromPerformanceNow || 0;
    const bundleStart = __BUNDLE_START_TIME__ || 0;
    return uiVisiblePerf && bundleStart
      ? Math.round(uiVisiblePerf - bundleStart)
      : 0;
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
