import { Platform } from 'react-native';

/*
DO NOT Expose any sensitive data here, this file will be injected to Dapp!!!!
 */
export type IPlatform = 'native' | 'desktop' | 'ext' | 'web' | 'webEmbed';
export type IDistributionChannel =
  | 'ext-chrome'
  | 'ext-firefox'
  | 'ext-edge'
  | 'desktop-mac'
  | 'desktop-mac-arm64'
  | 'desktop-win'
  | 'desktop-win-ms-store'
  | 'desktop-linux'
  | 'desktop-linux-snap'
  | 'native-ios'
  | 'native-ios-store'
  | 'native-android'
  | 'native-android-google'
  | 'native-android-huawei'
  | 'native-ios-pad'
  | 'native-ios-pad-store';

const { NODE_ENV } = process.env;
const { JEST_WORKER_ID } = process.env;

export type IPlatformEnv = {
  isNewRouteMode: boolean;

  version: string | undefined;
  buildNumber: string | undefined;
  NODE_ENV?: string;
  JEST_WORKER_ID?: string;

  isJest: boolean;

  isMultipleHistoryTxActionsSim?: boolean;

  /** development mode */
  isDev?: boolean;
  /** production mode */
  isProduction?: boolean;

  /** running in the browsers */
  isWeb?: boolean;
  isWebEmbed?: boolean;
  /** running in the desktop system APP */
  isDesktop?: boolean;
  /** running in the browser extension */
  isExtension?: boolean;
  /** running in mobile APP */
  isNative?: boolean;

  isDesktopLinux?: boolean;
  isDesktopLinuxSnap?: boolean;
  isDesktopWin?: boolean;
  isDesktopWinMsStore?: boolean;
  /** macos arm64 & x86 */
  isDesktopMac?: boolean;
  /** macos arm64 only */
  isDesktopMacArm64?: boolean;
  /** macos for appStore */
  isMas?: boolean;

  isExtFirefox?: boolean;
  isExtChrome?: boolean;
  isExtEdge?: boolean;
  isExtFirefoxUiPopup?: boolean;

  /** ios, both tablet & iPhone */
  isNativeIOS?: boolean;
  isNativeIOSStore?: boolean;
  /** ios, phone only */
  isNativeIOSPhone?: boolean;
  /** ios, tablet only */
  isNativeIOSPad?: boolean;
  isNativeIOSPadStore?: boolean;
  isNativeAndroid?: boolean;
  isNativeAndroidGooglePlay?: boolean;
  isNativeAndroidHuawei?: boolean;

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

  isRuntimeBrowser?: boolean;
  isRuntimeFirefox?: boolean;
  isRuntimeChrome?: boolean;

  canGetClipboard?: boolean;
  supportAutoUpdate?: boolean;

  isAppleStoreEnv?: boolean;
};

const isJest = JEST_WORKER_ID !== undefined || NODE_ENV === 'test';

const isDev = process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';

const isWeb = process.env.ONEKEY_PLATFORM === 'web';
const isWebEmbed = process.env.ONEKEY_PLATFORM === 'webEmbed';
const isDesktop = process.env.ONEKEY_PLATFORM === 'desktop';
const isExtension = process.env.ONEKEY_PLATFORM === 'ext';
const isNative = process.env.ONEKEY_PLATFORM === 'app';

const isExtChrome = process.env.EXT_CHANNEL === 'chrome';
const isExtFirefox = process.env.EXT_CHANNEL === 'firefox';
const isExtEdge = process.env.EXT_CHANNEL === 'edge';

const isDesktopMac = isDesktop && window?.desktopApi?.platform === 'darwin';
const isDesktopMacArm64 = isDesktopMac && window?.desktopApi?.arch === 'arm64';
const isDesktopWin = isDesktop && window?.desktopApi?.platform === 'win32';
const isDesktopWinMsStore =
  isDesktopWin && process.env.DESK_CHANNEL === 'ms-store';
const isDesktopLinux = isDesktop && window?.desktopApi?.platform === 'linux';
const isDesktopLinuxSnap =
  isDesktopLinux && window?.desktopApi?.channel === 'snap';

const isNativeIOS = isNative && Platform.OS === 'ios';
const isNativeIOSStore = isNativeIOS && isProduction;
const isNativeIOSPhone =
  isNative && Platform.OS === 'ios' && !Platform.isPad && !Platform.isTVOS;
const isNativeIOSPad = isNative && Platform.OS === 'ios' && Platform.isPad;
const isNativeIOSPadStore = isNativeIOSPad && isProduction;
const isNativeAndroid = isNative && Platform.OS === 'android';
const isNativeAndroidGooglePlay =
  isNativeAndroid && process.env.ANDROID_CHANNEL === 'google';
const isNativeAndroidHuawei =
  isNativeAndroid && process.env.ANDROID_CHANNEL === 'huawei';
const isMas = isDesktop && window?.desktopApi?.isMas;

// for platform building by file extension
const getPlatformSymbol = (): IPlatform | undefined => {
  if (isWeb) return 'web';
  if (isWebEmbed) return 'webEmbed';
  if (isDesktop) return 'desktop';
  if (isExtension) return 'ext';
  if (isNative) return 'native';
};

const getDistributionChannel = (): IDistributionChannel | undefined => {
  if (isExtChrome) return 'ext-chrome';
  if (isExtFirefox) return 'ext-firefox';
  if (isExtEdge) return 'ext-edge';

  if (isDesktopMacArm64) return 'desktop-mac-arm64';
  if (isDesktopMac) return 'desktop-mac';
  if (isDesktopWinMsStore) return 'desktop-win-ms-store';
  if (isDesktopWin) return 'desktop-win';
  if (isDesktopLinuxSnap) return 'desktop-linux-snap';
  if (isDesktopLinux) return 'desktop-linux';

  if (isNativeIOSPadStore) return 'native-ios-pad-store';
  if (isNativeIOSPad) return 'native-ios-pad';
  if (isNativeIOSStore) return 'native-ios-store';
  if (isNativeIOS) return 'native-ios';
  if (isNativeAndroidGooglePlay) return 'native-android-google';
  if (isNativeAndroidHuawei) return 'native-android-huawei';
  if (isNativeAndroid) return 'native-android';
};

const isRuntimeBrowser: boolean = typeof window !== 'undefined' && !isNative;

// @ts-ignore
const isRuntimeFirefox: boolean = typeof InstallTrigger !== 'undefined';

const checkIsRuntimeChrome = (): boolean => {
  if (!isRuntimeBrowser) {
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
  const winNav = window.navigator as typeof window.navigator | undefined;
  const vendorName = winNav ? winNav.vendor : '';
  // @ts-ignore
  const isOpera = typeof window.opr !== 'undefined';
  const isIEedge = winNav ? winNav.userAgent.indexOf('Edg') > -1 : false;
  const isIOSChrome = /CriOS/.exec(winNav ? winNav.userAgent : '');

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

const isRuntimeChrome = checkIsRuntimeChrome();

// Ext manifest v2 background
export const isExtensionBackgroundHtml: boolean =
  isExtension &&
  isRuntimeBrowser &&
  window.location.pathname.startsWith('/background.html');

// Ext manifest v3 background
export const isExtensionBackgroundServiceWorker: boolean =
  isExtension &&
  !isRuntimeBrowser &&
  // @ts-ignore
  Boolean(global.serviceWorker) &&
  // @ts-ignore
  global.serviceWorker instanceof ServiceWorker;

export const isExtensionBackground: boolean =
  isExtensionBackgroundHtml || isExtensionBackgroundServiceWorker;

export const isExtensionUi: boolean =
  isExtension &&
  isRuntimeBrowser &&
  window.location.pathname.startsWith('/ui-');

export const isExtensionUiPopup: boolean =
  isExtensionUi && window.location.pathname.startsWith('/ui-popup.html');

export const isExtensionUiExpandTab: boolean =
  isExtensionUi && window.location.pathname.startsWith('/ui-expand-tab.html');

export const isExtensionUiStandaloneWindow: boolean =
  isExtensionUi &&
  window.location.pathname.startsWith('/ui-standalone-window.html');

export const isManifestV3: boolean =
  // TODO firefox check v3
  isExtension && chrome.runtime.getManifest().manifest_version === 3;

export const canGetClipboard: boolean = !isWeb && !isExtension;

export const supportAutoUpdate: boolean =
  isDesktop && !(isMas || isDesktopLinuxSnap || isDesktopWinMsStore);

export const isAppleStoreEnv = isMas || isNativeIOSStore || isNativeIOSPadStore;

const platformEnv: IPlatformEnv = {
  isNewRouteMode: true,

  version: process.env.VERSION,
  buildNumber: process.env.BUILD_NUMBER,

  NODE_ENV,
  JEST_WORKER_ID,

  isJest,

  isMultipleHistoryTxActionsSim: false,

  isDev,
  isProduction,

  isWeb,
  isWebEmbed,
  isDesktop,
  isExtension,
  isNative,

  isDesktopMac,
  isDesktopWin,
  isDesktopWinMsStore,
  isDesktopMacArm64,
  isDesktopLinux,
  isDesktopLinuxSnap,
  isMas,

  isExtFirefox,
  isExtChrome,
  isExtEdge,

  isNativeIOS,
  isNativeIOSStore,
  isNativeIOSPhone,
  isNativeIOSPad,
  isNativeIOSPadStore,
  isNativeAndroid,
  isNativeAndroidGooglePlay,
  isNativeAndroidHuawei,

  symbol: getPlatformSymbol(),
  distributionChannel: getDistributionChannel(),

  isManifestV3,
  isExtensionBackground,
  isExtensionBackgroundHtml,
  isExtensionBackgroundServiceWorker,
  isExtensionUi,
  isExtensionUiPopup,
  isExtensionUiExpandTab,
  isExtensionUiStandaloneWindow,
  isExtFirefoxUiPopup: isExtFirefox && isExtensionUiPopup,

  isRuntimeBrowser,
  isRuntimeFirefox,
  isRuntimeChrome,

  canGetClipboard,
  supportAutoUpdate,
  isAppleStoreEnv,
};

if (isDev) {
  global.$$platformEnv = platformEnv;
}

/*
DO NOT Expose any sensitive data here, this file will be injected to Dapp!!!!
 */

export default platformEnv;
