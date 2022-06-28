import { Platform } from 'react-native';

/*
DO NOT Expose any sensitive data here, this file will be injected to Dapp!!!!
 */
export type IPlatform = 'native' | 'desktop' | 'ext' | 'web';
export type IDistributionChannel =
  | 'ext-chrome'
  | 'ext-firefox'
  | 'desktop-mac'
  | 'desktop-mac-arm64'
  | 'desktop-win'
  | 'desktop-linux'
  | 'native-ios'
  | 'native-ios-store'
  | 'native-android'
  | 'native-android-google';

export type IPlatformEnv = {
  isLegacyHistory?: boolean;
  isLegacySendConfirm?: boolean;
  isDev?: boolean;
  isProduction?: boolean;

  isWeb?: boolean;
  isDesktop?: boolean;
  isExtension?: boolean;
  isNative?: boolean;

  isDesktopLinux?: boolean;
  isDesktopWin?: boolean;
  isDesktopMac?: boolean;
  isDesktopMacArm64?: boolean;

  isExtFirefox?: boolean;
  isExtChrome?: boolean;
  isExtFirefoxUiPopup?: boolean;

  isNativeIOS?: boolean;
  isNativeIOSStore?: boolean;
  isNativeAndroid?: boolean;
  isNativeAndroidGooglePlay?: boolean;

  symbol: IPlatform | undefined;
  distributionChannel: IDistributionChannel | undefined;

  isManifestV3?: boolean;
  isExtensionBackground?: boolean;
  isExtensionBackgroundHtml?: boolean;
  isExtensionBackgroundServiceWorker?: boolean;
  isExtensionUi?: boolean;
  isExtensionUiPopup?: boolean;
  isExtensionUiExpandTab?: boolean;
  isExtensionUiStandaloneWindow?: boolean;
  isInjected?: boolean;

  isRuntimeBrowser?: boolean;
  isRuntimeFirefox?: boolean;
  isRuntimeChrome?: boolean;

  canGetClipboard?: boolean;
};

export const isJest = (): boolean => process.env.JEST_WORKER_ID !== undefined;

const isDev = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

const isWeb = process.env.ONEKEY_PLATFORM === 'web';
const isDesktop = process.env.ONEKEY_PLATFORM === 'desktop';
const isExtension = process.env.ONEKEY_PLATFORM === 'ext';
const isNative = process.env.ONEKEY_PLATFORM === 'app';

const isExtChrome = process.env.EXT_CHANNEL === 'chrome';
const isExtFirefox = process.env.EXT_CHANNEL === 'firefox';

const isDesktopMac = isDesktop && window?.desktopApi?.platform === 'darwin';
const isDesktopMacArm64 = isDesktopMac && window?.desktopApi?.arch === 'arm64';
const isDesktopWin = isDesktop && window?.desktopApi?.platform === 'win32';
const isDesktopLinux = isDesktop && window?.desktopApi?.platform === 'linux';

const isNativeIOS = isNative && Platform.OS === 'ios';
const isNativeIOSStore = isNativeIOS && isProduction;
const isNativeAndroid = isNative && Platform.OS === 'android';
const isNativeAndroidGooglePlay =
  isNativeAndroid && process.env.ANDROID_CHANNEL === 'google';

const getPlatformSymbol = (): IPlatform | undefined => {
  if (isWeb) return 'web';
  if (isDesktop) return 'desktop';
  if (isExtension) return 'ext';
  if (isNative) return 'native';
};

const getDistributionChannel = (): IDistributionChannel | undefined => {
  if (isExtChrome) return 'ext-chrome';
  if (isExtFirefox) return 'ext-firefox';

  if (isDesktopMacArm64) return 'desktop-mac-arm64';
  if (isDesktopMac) return 'desktop-mac';
  if (isDesktopWin) return 'desktop-win';
  if (isDesktopLinux) return 'desktop-linux';

  if (isNativeIOSStore) return 'native-ios-store';
  if (isNativeIOS) return 'native-ios';
  if (isNativeAndroidGooglePlay) return 'native-android-google';
  if (isNativeAndroid) return 'native-android';
};

const isRuntimeBrowser = (): boolean =>
  typeof window !== 'undefined' && !isNative;

// @ts-ignore
const isRuntimeFirefox = (): boolean => typeof InstallTrigger !== 'undefined';

const isRuntimeChrome = (): boolean => {
  if (!isRuntimeBrowser()) {
    return false;
  }
  // please note,
  // that IE11 now returns undefined again for window.chrome
  // and new Opera 30 outputs true for window.chrome
  // but needs to check if window.opr is not undefined
  // and new IE Edge outputs to true now for window.chrome
  // and if not iOS Chrome check
  // so use the below updated condition
  const isChromium = window.chrome;
  const winNav = window.navigator;
  const vendorName = winNav.vendor;
  // @ts-ignore
  const isOpera = typeof window.opr !== 'undefined';
  const isIEedge = winNav.userAgent.indexOf('Edg') > -1;
  const isIOSChrome = /CriOS/.exec(winNav.userAgent);

  if (isIOSChrome) {
    // is Google Chrome on IOS
    return true;
  }
  if (
    isChromium !== null &&
    typeof isChromium !== 'undefined' &&
    vendorName === 'Google Inc.' &&
    !isOpera &&
    !isIEedge
  ) {
    // is Google Chrome
    return true;
  }
  // not Google Chrome
  return false;
};

export const isInjected = (): boolean =>
  process.env.ONEKEY_BUILD_TYPE === 'injected';

// Ext manifest v2 background
export const isExtensionBackgroundHtml = (): boolean =>
  isExtension &&
  isRuntimeBrowser() &&
  window.location.pathname.startsWith('/background.html');

// Ext manifest v3 background
export const isExtensionBackgroundServiceWorker = (): boolean =>
  isExtension &&
  !isRuntimeBrowser() &&
  // @ts-ignore
  Boolean(global.serviceWorker) &&
  // @ts-ignore
  global.serviceWorker instanceof ServiceWorker;

export const isExtensionBackground = (): boolean =>
  isExtensionBackgroundHtml() || isExtensionBackgroundServiceWorker();

export const isExtensionUi = (): boolean =>
  isExtension &&
  isRuntimeBrowser() &&
  window.location.pathname.startsWith('/ui-');

export const isExtensionUiPopup = (): boolean =>
  isExtensionUi() && window.location.pathname.startsWith('/ui-popup.html');

export const isExtensionUiExpandTab = (): boolean =>
  isExtensionUi() && window.location.pathname.startsWith('/ui-expand-tab.html');

export const isExtensionUiStandaloneWindow = (): boolean =>
  isExtensionUi() &&
  window.location.pathname.startsWith('/ui-standalone-window.html');

export const isManifestV3 = (): boolean =>
  // TODO firefox check v3
  isExtension && chrome.runtime.getManifest().manifest_version === 3;

export const canGetClipboard = (): boolean => !isWeb && !isExtension;

const platformEnv: IPlatformEnv = {
  isLegacyHistory: false, // TODO remove
  isLegacySendConfirm: false, // TODO remove
  isDev,
  isProduction,

  isWeb,
  isDesktop,
  isExtension,
  isNative,

  isDesktopMac,
  isDesktopWin,
  isDesktopMacArm64,
  isDesktopLinux,

  isExtFirefox,
  isExtChrome,

  isNativeIOS,
  isNativeIOSStore,
  isNativeAndroid,
  isNativeAndroidGooglePlay,

  symbol: getPlatformSymbol(),
  distributionChannel: getDistributionChannel(),

  isManifestV3: isManifestV3(),
  isExtensionBackground: isExtensionBackground(),
  isExtensionBackgroundHtml: isExtensionBackgroundHtml(),
  isExtensionBackgroundServiceWorker: isExtensionBackgroundServiceWorker(),
  isExtensionUi: isExtensionUi(),
  isExtensionUiPopup: isExtensionUiPopup(),
  isExtensionUiExpandTab: isExtensionUiExpandTab(),
  isExtensionUiStandaloneWindow: isExtensionUiStandaloneWindow(),
  isExtFirefoxUiPopup: isExtFirefox && isExtensionUiPopup(),

  isInjected: isInjected(),

  isRuntimeBrowser: isRuntimeBrowser(),
  isRuntimeFirefox: isRuntimeFirefox(),
  isRuntimeChrome: isRuntimeChrome(),

  canGetClipboard: canGetClipboard(),
};

if (isDev) {
  global.$$platformEnv = platformEnv;

  console.log('OneKey-Platform', platformEnv.symbol);
  console.log('OneKey-Distribution-Channel', platformEnv.distributionChannel);
}

/*
DO NOT Expose any sensitive data here, this file will be injected to Dapp!!!!
 */

export default platformEnv;
