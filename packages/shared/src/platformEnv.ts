import { Platform } from 'react-native';

export type IPlatformEnv = {
  isMac?: boolean;
  isWindows?: boolean;
  isLinux?: boolean;

  isWeb?: boolean;
  isDesktop?: boolean;
  isExtension?: boolean;
  isExtensionBackground?: boolean;
  isExtensionUi?: boolean;
  isExtensionUiPopup?: boolean;
  isExtensionUiExpandTab?: boolean;
  isExtensionUiStandaloneWindow?: boolean;
  isNative?: boolean;
  isInjected?: boolean;

  isMAS?: boolean;
  isDev?: boolean;
  isBrowser?: boolean;
  isFirefox?: boolean;
  isIOS?: boolean;
  isAndroid?: boolean;
};

export const isJest = (): boolean => process.env.JEST_WORKER_ID !== undefined;

export const isBrowser = (): boolean => typeof window !== 'undefined';

// @ts-ignore
export const isFirefox = (): boolean => typeof InstallTrigger !== 'undefined';

export const isWeb = (): boolean => process.env.ONEKEY_BUILD_TYPE === 'web';

export const isExtension = (): boolean =>
  process.env.ONEKEY_BUILD_TYPE === 'ext';

export const isInjected = (): boolean =>
  process.env.ONEKEY_BUILD_TYPE === 'injected';

export const isExtensionBackground = (): boolean =>
  isExtension() &&
  !isBrowser() &&
  // TODO firefox\edge\brave check
  // @ts-ignore
  global.serviceWorker instanceof ServiceWorker;

export const isExtensionUi = (): boolean =>
  isExtension() && isBrowser() && window.location.pathname.startsWith('/ui-');

export const isExtensionUiPopup = (): boolean =>
  isExtensionUi() && window.location.pathname.startsWith('/ui-popup.html');

export const isExtensionUiExpandTab = (): boolean =>
  isExtensionUi() && window.location.pathname.startsWith('/ui-expand-tab.html');

export const isExtensionUiStandaloneWindow = (): boolean =>
  isExtensionUi() &&
  window.location.pathname.startsWith('/ui-standalone-window.html');

export const isDesktop = (): boolean =>
  process.env.ONEKEY_BUILD_TYPE === 'desktop';

export const isMac = (): boolean => {
  if (typeof process === 'undefined') return false;
  if (process.platform === 'darwin') return true; // For usage in Electron (SSR)
  if (typeof navigator === 'undefined') return false;
  return ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'].includes(
    navigator.platform,
  );
};

export const isWindows = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return ['Win32', 'Win64', 'Windows', 'WinCE'].includes(navigator.platform);
};

export const isLinux = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Linux/.test(navigator.platform);
};

// MAC APP Store mode
export const isMAS = (): boolean => !!process.env.IS_MAS;

export const isDev = (): boolean => process.env.NODE_ENV === 'development';

export const isIOS = (): boolean => Platform.OS === 'ios';

export const isAndroid = (): boolean => Platform.OS === 'android';

export const isNative = (): boolean => isAndroid() || isIOS();

const platformEnv: IPlatformEnv = {
  isMac: isMac(),
  isWindows: isWindows(),
  isLinux: isLinux(),

  isWeb: isWeb(),
  isDesktop: isDesktop(),
  isExtension: isExtension(),
  isExtensionBackground: isExtensionBackground(),
  isExtensionUi: isExtensionUi(),
  isExtensionUiPopup: isExtensionUiPopup(),
  isExtensionUiExpandTab: isExtensionUiExpandTab(),
  isExtensionUiStandaloneWindow: isExtensionUiStandaloneWindow(),
  isNative: isNative(),
  isInjected: isInjected(),

  isMAS: isMAS(),
  isDev: isDev(),
  isBrowser: isBrowser(),
  isFirefox: isFirefox(),
  isIOS: isIOS(),
  isAndroid: isAndroid(),
};

if (isDev()) {
  global.$$platformEnv = platformEnv;
}

export default platformEnv;
