import type { ILaunchOptionsManagerInterface } from './type';

const getStartupTimeAt = () => {
  return globalThis.$$onekeyStartupTimeAt || 0;
};

const getJSReadyTimeAt = () => {
  return globalThis.$$onekeyJsReadyAt || 0;
};

const getUIVisibleTimeAt = () => {
  return globalThis.$$onekeyUIVisibleAt || 0;
};

const LaunchOptionsManager: ILaunchOptionsManagerInterface = {
  getLaunchOptions: () => Promise.resolve(null),
  clearLaunchOptions: () => Promise.resolve(true),
  getDeviceToken: () => Promise.resolve(null),
  getStartupTime: () => {
    return Promise.resolve(getStartupTimeAt());
  },
  getStartupTimeAt: () => {
    return Promise.resolve(getStartupTimeAt());
  },
  getJSReadyTimeAt: () => {
    return Promise.resolve(getJSReadyTimeAt());
  },
  getUIVisibleTimeAt: () => {
    return Promise.resolve(getUIVisibleTimeAt());
  },
  getJSReadyTime: async () => {
    const jsReadyAt = getJSReadyTimeAt();
    const startupAt = getStartupTimeAt();
    const duration = jsReadyAt && startupAt ? jsReadyAt - startupAt : 0;
    return Promise.resolve(duration > 0 ? duration : 0);
  },
  getUIVisibleTime: async () => {
    const startupAt = getStartupTimeAt();
    const uiVisibleAt = getUIVisibleTimeAt();
    const duration = uiVisibleAt && startupAt ? uiVisibleAt - startupAt : 0;
    return Promise.resolve(duration > 0 ? duration : 0);
  },
  getBundleStartTime: () => {
    return Promise.resolve(0);
  },
  getJsReadyFromPerformanceNow: () => {
    return Promise.resolve(0);
  },
  getUIVisibleFromPerformanceNow: () => {
    return Promise.resolve(0);
  },
};

export default LaunchOptionsManager;
