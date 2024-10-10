import MobileDetect from 'mobile-detect';
import { Platform } from 'react-native';

import { isWebInDappMode } from './utils/devModeUtils';

/*
DO NOT Expose any sensitive data here, this file will be injected to Dapp!!!!
 */
export type IAppPlatform =
  | 'extension'
  | 'ios'
  | 'android'
  | 'desktop'
  | 'web'
  | 'webEmbed';
export type IPlatformLegacy = 'native' | 'desktop' | 'ext' | 'web' | 'webEmbed';
export type IAppChannel =
  | 'chrome'
  | 'firefox'
  | 'edge'
  | 'phone'
  | 'pad'
  | 'apk'
  | 'googlePlay'
  | 'huaweiStore'
  | 'macosARM'
  | 'macosX86'
  | 'macosStore'
  | 'win'
  | 'winStore'
  | 'linux'
  | 'linuxSnap';

export type IPlatformEnv = {
  isNewRouteMode: boolean;

  version: string | undefined;
  buildNumber: string | undefined;
  githubSHA: string | undefined;
  NODE_ENV?: string;
  JEST_WORKER_ID?: string;

  isJest: boolean;

  isMultipleHistoryTxActionsSim?: boolean;

  /** development mode */
  isDev?: boolean;
  /** production mode */
  isProduction?: boolean;
  /** e2e mode */
  isE2E?: boolean;

  /** running in the browsers */
  isWeb?: boolean;
  isWebDappMode?: boolean;
  isWebTouchable?: boolean;
  isWebEmbed?: boolean;
  isWebMobile?: boolean;
  isWebMobileAndroid?: boolean;
  isWebMobileIOS?: boolean;
  isWebSafari?: boolean;
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

  appPlatform: IAppPlatform | undefined;
  symbol: IPlatformLegacy | undefined;
  appChannel: IAppChannel | undefined;
  browserInfo?: string;

  isManifestV3?: boolean;
  isExtensionBackground?: boolean;
  isExtensionBackgroundHtml?: boolean;
  isExtensionBackgroundServiceWorker?: boolean;
  isExtensionOffscreen?: boolean;
  isExtensionUi?: boolean;
  isExtensionUiPassKey?: boolean;
  isExtensionUiPopup?: boolean;
  isExtensionUiExpandTab?: boolean;
  isExtensionUiSidePanel?: boolean;
  isExtensionUiStandaloneWindow?: boolean;

  isRuntimeBrowser?: boolean;
  isRuntimeMacOSBrowser?: boolean;
  isRuntimeFirefox?: boolean;
  isRuntimeChrome?: boolean;
  isRuntimeEdge?: boolean;
  isRuntimeBrave?: boolean;

  supportAutoUpdate?: boolean;

  isAppleStoreEnv?: boolean;
};

const {
  isJest,
  isDev,
  isProduction,
  isWeb,
  isWebEmbed,
  isDesktop,
  isExtension,
  isNative,
  isExtChrome,
  isExtFirefox,
  isExtEdge,
  isE2E,
}: {
  isJest: boolean;
  isDev: boolean;
  isProduction: boolean;
  isWeb: boolean;
  isWebEmbed: boolean;
  isDesktop: boolean;
  isExtension: boolean;
  isNative: boolean;
  isExtChrome: boolean;
  isExtFirefox: boolean;
  isExtEdge: boolean;
  isE2E: boolean;
} = require('./buildTimeEnv.js');

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
  isNative && Platform.OS === 'ios' && !Platform.isPad && !Platform.isTV;
const isNativeIOSPad = isNative && Platform.OS === 'ios' && Platform.isPad;
const isNativeIOSPadStore = isNativeIOSPad && isProduction;
const isNativeAndroid = isNative && Platform.OS === 'android';
const isNativeAndroidGooglePlay =
  isNativeAndroid && process.env.ANDROID_CHANNEL === 'google';
const isNativeAndroidHuawei =
  isNativeAndroid && process.env.ANDROID_CHANNEL === 'huawei';
const isMas = isDesktop && window?.desktopApi?.isMas;

// for platform building by file extension
const getAppPlatform = (): IAppPlatform | undefined => {
  if (isWeb) return 'web';
  if (isWebEmbed) return 'webEmbed';
  if (isDesktop) return 'desktop';
  if (isExtension) return 'extension';
  if (isNativeIOS) return 'ios';
  if (isNativeAndroid) return 'android';
};

const getPlatformSymbolLegacy = (): IPlatformLegacy | undefined => {
  if (isWeb) return 'web';
  if (isWebEmbed) return 'webEmbed';
  if (isDesktop) return 'desktop';
  if (isExtension) return 'ext';
  if (isNative) return 'native';
};

const getAppChannel = (): IAppChannel | undefined => {
  if (isExtChrome) return 'chrome';
  if (isExtFirefox) return 'firefox';
  if (isExtEdge) return 'edge';

  if (isNativeIOSPad) return 'pad';
  if (isNativeIOSPhone) return 'phone';

  if (isNativeAndroidHuawei) return 'huaweiStore';
  if (isNativeAndroidGooglePlay) return 'googlePlay';
  if (isNativeAndroid) return 'apk';

  if (isDesktopWinMsStore) return 'winStore';
  if (isDesktopWin) return 'win';
  if (isMas) return 'macosStore';
  if (isDesktopMacArm64) return 'macosARM';
  if (isDesktopMac) return 'macosX86';
  if (isDesktopLinuxSnap) return 'linuxSnap';
  if (isDesktopLinux) return 'linux';
};

const isRuntimeBrowser: boolean = typeof window !== 'undefined' && !isNative;

// @ts-ignore
const isRuntimeFirefox: boolean = typeof InstallTrigger !== 'undefined';

const checkIsRuntimeEdge = (): boolean => {
  if (!isRuntimeBrowser) {
    return false;
  }
  const isChromium = window.chrome;
  const winNav = window.navigator as typeof window.navigator | undefined;
  const isIEEdge = winNav ? winNav.userAgent.indexOf('Edg') > -1 : false;

  if (isChromium && isIEEdge === true) return true;

  return false;
};

const checkIsRuntimeBrave = (): boolean => {
  if (!isRuntimeBrowser) {
    return false;
  }
  // @ts-ignore
  const { brave } = navigator;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
  return (brave && brave?.isBrave?.name === 'isBrave') || false;
};

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
  const isIEEdge = winNav ? winNav.userAgent.indexOf('Edg') > -1 : false;
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
    !isIEEdge
  ) {
    // is Google Chrome
    return true;
  }
  // not Google Chrome
  return false;
};

const isMacPlatform = (platform: string): boolean =>
  platform ? platform.includes('mac') || platform.includes('darwin') : false;
const checkIsRuntimeMacOSBrowser = (): boolean => {
  if (!isRuntimeBrowser) {
    return false;
  }
  if (typeof navigator !== 'undefined') {
    const platform =
      navigator.platform?.toLowerCase() ||
      (
        navigator as { userAgentData?: { platform: string } }
      ).userAgentData?.platform?.toLowerCase() ||
      '';
    return isMacPlatform(platform);
  }
  return false;
};

const getBrowserInfo = () => {
  const browserInfo = {
    name: 'unknown',
    version: 'unknown',
  };
  if (isRuntimeBrowser) {
    try {
      const userAgent = window.navigator.userAgent.toLowerCase();

      if (userAgent.indexOf('firefox') > -1) {
        browserInfo.name = 'Firefox';
        browserInfo.version =
          userAgent.match(/firefox\/([\d.]+)/)?.[1] ?? 'unknown';
      } else if (userAgent.indexOf('chrome') > -1) {
        browserInfo.name = 'Chrome';
        browserInfo.version =
          userAgent.match(/chrome\/([\d.]+)/)?.[1] ?? 'unknown';
      } else if (userAgent.indexOf('safari') > -1) {
        browserInfo.name = 'Safari';
        browserInfo.version =
          userAgent.match(/version\/([\d.]+)/)?.[1] ?? 'unknown';
      } else if (
        userAgent.indexOf('msie') > -1 ||
        userAgent.indexOf('trident') > -1
      ) {
        browserInfo.name = 'Internet Explorer';
        browserInfo.version =
          userAgent.match(/(?:msie |rv:)(\d+(\.\d+)?)/)?.[1] ?? 'unknown';
      }
    } catch (e) {
      console.error('getBrowserInfo error:', e);
    }
  }
  return `browser name: ${browserInfo.name}, browser version: ${browserInfo.version}`;
};

const isWebTouchable =
  isRuntimeBrowser &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

let isWebMobile = false;
let isWebMobileAndroid = false;
let isWebMobileIOS = false;
let isWebSafari = false;
let isWebDappMode = false;
(function () {
  if (!isWeb) {
    return;
  }
  // https://hgoebl.github.io/mobile-detect.js/doc/MobileDetect.html
  const md = new MobileDetect(window.navigator?.userAgent);
  const mobileInfo = md.mobile();
  isWebMobile = Boolean(mobileInfo);
  const os = md.os();
  const ua = md.userAgent();

  isWebMobileAndroid = os === 'AndroidOS';
  isWebMobileIOS = os === 'iOS' || os === 'iPadOS';
  isWebSafari =
    ua === 'Safari' || window.navigator?.userAgent?.includes('Safari');
  isWebDappMode = isWebInDappMode();
})();

const isRuntimeChrome = checkIsRuntimeChrome();
const isRuntimeEdge = checkIsRuntimeEdge();
const isRuntimeBrave = checkIsRuntimeBrave();
const isRuntimeMacOSBrowser = isDesktopMac || checkIsRuntimeMacOSBrowser();

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

const isExtensionOffscreen: boolean =
  isExtension &&
  isRuntimeBrowser &&
  window.location.pathname.startsWith('/offscreen.html');

export const isExtensionUi: boolean =
  isExtension &&
  isRuntimeBrowser &&
  window.location.pathname.startsWith('/ui-');

export const isExtensionUiPassKey: boolean =
  isExtensionUi && window.location.pathname.startsWith('/ui-passkey.html');

export const isExtensionUiPopup: boolean =
  isExtensionUi && window.location.pathname.startsWith('/ui-popup.html');

export const isExtensionUiExpandTab: boolean =
  isExtensionUi && window.location.pathname.startsWith('/ui-expand-tab.html');

export const isExtensionUiSidePanel: boolean =
  isExtensionUi && window.location.pathname.startsWith('/ui-side-panel.html');

export const isExtensionUiStandaloneWindow: boolean =
  isExtensionUi &&
  window.location.pathname.startsWith('/ui-standalone-window.html');

export const isManifestV3: boolean =
  // TODO firefox check v3
  isExtension && chrome?.runtime?.getManifest?.()?.manifest_version === 3;

export const supportAutoUpdate: boolean =
  isDesktop && !(isMas || isDesktopLinuxSnap || isDesktopWinMsStore);

export const isAppleStoreEnv = isMas || isNativeIOSStore || isNativeIOSPadStore;

const platformEnv: IPlatformEnv = {
  isNewRouteMode: true,

  version: process.env.VERSION,
  buildNumber: process.env.BUILD_NUMBER,
  githubSHA: process.env.GITHUB_SHA,

  isJest,

  isMultipleHistoryTxActionsSim: false,

  isDev,
  isProduction,
  isE2E,

  isWeb,
  isWebDappMode,
  isWebTouchable,
  isWebEmbed,
  isWebMobile,
  isWebMobileAndroid,
  isWebMobileIOS,
  isWebSafari,
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

  isNativeIOS,
  isNativeIOSStore,
  isNativeIOSPhone,
  isNativeIOSPad,
  isNativeIOSPadStore,
  isNativeAndroid,
  isNativeAndroidGooglePlay,
  isNativeAndroidHuawei,

  symbol: getPlatformSymbolLegacy(),
  appPlatform: getAppPlatform(),
  appChannel: getAppChannel(),
  browserInfo: getBrowserInfo(),

  isManifestV3,
  isExtensionBackground,
  isExtensionBackgroundHtml,
  isExtensionBackgroundServiceWorker,
  isExtensionOffscreen,
  isExtensionUiPassKey,
  isExtensionUi,
  isExtensionUiPopup,
  isExtensionUiExpandTab,
  isExtensionUiSidePanel,
  isExtensionUiStandaloneWindow,
  isExtFirefoxUiPopup: isExtFirefox && isExtensionUiPopup,

  isRuntimeBrowser,
  isRuntimeMacOSBrowser,
  isRuntimeFirefox,
  isRuntimeChrome,
  isRuntimeEdge,
  isRuntimeBrave,

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
