import { Platform } from 'react-native';

export const isMac = (): boolean => {
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

export const isWeb = (): boolean => process.env.ONEKEY_BUILD_TYPE === 'web';

export const isDesktop = (): boolean =>
  process.env.ONEKEY_BUILD_TYPE === 'desktop';

// MAC APP Store mode
export const isMAS = (): boolean => !!process.env.IS_MAS;

export const isDev = (): boolean => process.env.NODE_ENV === 'development';

export const isIos = (): boolean => Platform.OS === 'ios';

export const isAndroid = (): boolean => Platform.OS === 'android';

export const isNative = (): boolean => isAndroid() || isIos();
