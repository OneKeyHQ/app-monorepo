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

// `__BUNDLE_START_TIME__` is injected by the Metro/RN bundle. In test harness,
// bg-thread runtime, or partial OTA boot it may not be declared at all — and
// `__BUNDLE_START_TIME__ || 0` would throw `ReferenceError` on an undeclared
// identifier, not fall back to 0. `typeof` is the only safe probe.
const getBundleStartTimeSafe = (): number =>
  typeof __BUNDLE_START_TIME__ !== 'undefined' ? __BUNDLE_START_TIME__ : 0;

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
    const jsReadyPerf = globalThis.$$onekeyJsReadyFromPerformanceNow || 0;
    const bundleStart = getBundleStartTimeSafe();
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
    const bundleStart = getBundleStartTimeSafe();
    return uiVisiblePerf && bundleStart
      ? Math.round(uiVisiblePerf - bundleStart)
      : 0;
  },
  getBundleStartTime: () => {
    return Promise.resolve(Math.round(getBundleStartTimeSafe()));
  },
  getJsReadyFromPerformanceNow: () => {
    const bundleStart = getBundleStartTimeSafe();
    return Promise.resolve(
      Math.round(
        (globalThis.$$onekeyJsReadyFromPerformanceNow || 0) - bundleStart,
      ),
    );
  },
  getUIVisibleFromPerformanceNow: () => {
    const bundleStart = getBundleStartTimeSafe();
    return Promise.resolve(
      Math.round(
        (globalThis.$$onekeyUIVisibleFromPerformanceNow || 0) - bundleStart,
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
