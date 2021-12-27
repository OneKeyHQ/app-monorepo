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
  isNative?: boolean;

  isMAS?: boolean;
  isDev?: boolean;
  isBrowser?: boolean;
  isIOS?: boolean;
  isAndroid?: boolean;
};

export const isBrowser = (): boolean => typeof window !== 'undefined';

export const isWeb = (): boolean => process.env.ONEKEY_BUILD_TYPE === 'web';

export const isExtension = (): boolean =>
  process.env.ONEKEY_BUILD_TYPE === 'ext';

export const isExtensionBackground = (): boolean =>
  isExtension() &&
  !isBrowser() &&
  // TODO firefox\edge\brave check
  // @ts-ignore
  global.serviceWorker instanceof ServiceWorker;

export const isExtensionUi = (): boolean =>
  isExtension() &&
  isBrowser() &&
  window.location.host === chrome.runtime.id &&
  window.location.pathname.startsWith('/ui-');

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
  isExtensionUi: isExtensionUi(),
  isExtensionBackground: isExtensionBackground(),
  isNative: isNative(),

  isMAS: isMAS(),
  isDev: isDev(),
  isBrowser: isBrowser(),
  isIOS: isIOS(),
  isAndroid: isAndroid(),
};

if (isDev()) {
  global.$$platformEnv = platformEnv;
}

export default platformEnv;
