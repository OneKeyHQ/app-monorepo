import {
  canOpenURL as linkingCanOpenURL,
  openSettings as linkingOpenSettings,
  openURL as linkingOpenURL,
} from 'expo-linking';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalWebViewRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { ETranslations } from '../locale';

import { parseUrl } from './uriUtils';

import type { IPrefType } from '../../types/desktop';
import type { EWebEmbedRoutePath } from '../consts/webEmbedConsts';

// ========== Discovery Browser ==========

export interface IOpenUrlInDiscoveryParams {
  url: string;
  title?: string;
}

/**
 * Pending URL to be opened in Discovery browser
 * This is checked by the Discovery component on mount/focus
 */
let pendingDiscoveryUrl: { url: string; title?: string } | null = null;

/**
 * Get and clear the pending Discovery URL
 * Used internally by Discovery component
 */
export function getPendingDiscoveryUrl(): {
  url: string;
  title?: string;
} | null {
  const pending = pendingDiscoveryUrl;
  pendingDiscoveryUrl = null;
  return pending;
}

/**
 * Set a pending Discovery URL to be opened
 * Used internally by openUrlInDiscovery
 */
export function setPendingDiscoveryUrl(url: string, title?: string): void {
  pendingDiscoveryUrl = { url, title };
}

export function clearPendingDiscoveryUrl(): void {
  pendingDiscoveryUrl = null;
}

const openUrlByWebview = (url: string, title?: string) => {
  appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.WebViewModal,
    params: {
      screen: EModalWebViewRoutes.WebView,
      params: {
        url,
        title,
      },
    },
  });
};

function openUrlByWebviewPro({
  url,
  title,
  isWebEmbed,
  hashRoutePath,
  hashRouteQueryParams,
}: {
  url: string;
  title: string;
  isWebEmbed?: boolean;
  hashRoutePath?: EWebEmbedRoutePath;
  hashRouteQueryParams?: Record<string, string>;
}) {
  appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
    screen: EModalRoutes.WebViewModal,
    params: {
      screen: EModalWebViewRoutes.WebView,
      params: {
        url,
        title,
        isWebEmbed,
        hashRoutePath,
        hashRouteQueryParams,
      },
    },
  });
}

const openUrlOutsideNative = (url: string): void => {
  if (platformEnv.isExtension) {
    void chrome.tabs.create({
      url,
    });
  } else {
    window.open(url, '_blank');
  }
};

export const openUrlInApp = (url: string, title?: string) => {
  if (platformEnv.isNative || platformEnv.isDesktop) {
    openUrlByWebview(url.trim(), title);
  } else {
    openUrlOutsideNative(url.trim());
  }
};

export interface IOpenUrlExternalOptions {
  /**
   * Skip the in-app browser and hand the URL to the OS. Use for OAuth
   * redirects, WebUSB tool pages, store links, and explicit
   * "open in external browser" user actions.
   */
  useSystemBrowser?: boolean;
}

// Store/social links must reach the native app via universal links;
// in-app browsers never trigger universal-link handoff. Server-driven
// URLs (banners, notifications) may carry these, so enforce centrally.
const STORE_HOSTS = new Set([
  'apps.apple.com',
  'itunes.apple.com',
  'testflight.apple.com',
  'play.google.com',
]);
const SOCIAL_APP_HOSTS = new Set([
  'twitter.com',
  'x.com',
  't.me',
  'discord.com',
  'discord.gg',
]);

// Dev-settings kill switch, pushed in from kit (shared cannot import kit-bg).
let forceSystemBrowserForDebug = false;
export const setForceSystemBrowserForDebug = (value: boolean) => {
  forceSystemBrowserForDebug = value;
};

const isSystemBrowserOnlyHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return STORE_HOSTS.has(host) || SOCIAL_APP_HOSTS.has(host);
};

const trackOpenUrl = (url: string, method: 'inApp' | 'system') => {
  const parsedUrl = parseUrl(url);
  // Host-level only: never report the full URL or its query params.
  const host = parsedUrl?.hostname || parsedUrl?.urlSchema || 'unknown';
  appGlobals.$defaultLogger?.app.page.openExternalUrl({ host, method });
};

const openUrlInAppBrowserNative = async (url: string): Promise<void> => {
  // Lazy import: must never load on the native background JS runtime,
  // and web/ext/desktop bundles don't need it.
  const webBrowser = await import('expo-web-browser');
  // createTask:false keeps the Custom Tab inside OneKey's Android task
  // (BACK returns to the app; singleTask MainActivity clears it on
  // deep-link re-entry). iOS presents SFSafariViewController as a page
  // sheet (swipe down or X to dismiss); the promise only resolves once
  // the browser is dismissed. presentationStyle/dismissButtonStyle are
  // iOS-only, enableBarCollapsing applies to both platforms.
  await webBrowser.openBrowserAsync(url, {
    createTask: false,
    presentationStyle: webBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    dismissButtonStyle: 'close',
    enableBarCollapsing: true,
  });
};

export const openUrlExternal = (
  url: string,
  options?: IOpenUrlExternalOptions,
) => {
  const trimmedUrl = url.trim();
  if (!platformEnv.isNative) {
    openUrlOutsideNative(trimmedUrl);
    return;
  }
  if (
    options?.useSystemBrowser ||
    forceSystemBrowserForDebug ||
    // The background JS runtime cannot present a native view controller.
    platformEnv.isNativeBackgroundThread
  ) {
    trackOpenUrl(trimmedUrl, 'system');
    void linkingOpenURL(trimmedUrl);
    return;
  }
  const parsedUrl = parseUrl(trimmedUrl);
  const isHttpUrl =
    parsedUrl?.urlSchema === 'http' || parsedUrl?.urlSchema === 'https';
  if (!parsedUrl || !isHttpUrl || isSystemBrowserOnlyHost(parsedUrl.hostname)) {
    trackOpenUrl(trimmedUrl, 'system');
    void linkingOpenURL(trimmedUrl);
    return;
  }
  trackOpenUrl(trimmedUrl, 'inApp');
  openUrlInAppBrowserNative(trimmedUrl).catch(() => {
    // e.g. Android NoMatchingActivityException when no installed browser
    // supports Custom Tabs — fall back to the system browser.
    void linkingOpenURL(trimmedUrl);
  });
};

export const dismissNativeInAppBrowser = () => {
  // iOS-only API; Android Custom Tabs are cleared by singleTask re-entry.
  if (!platformEnv.isNativeIOS) {
    return;
  }
  void import('expo-web-browser')
    .then((webBrowser) => webBrowser.dismissBrowser())
    .catch(() => {});
};

export const openSettings = (prefType: IPrefType) => {
  if (platformEnv.isNative) {
    // android notification settings
    // Notifications.openSettingsAsync();
    void linkingOpenSettings();
  } else {
    void globalThis.desktopApiProxy.system.openPreferences(prefType);
  }
};

/**
 * Navigate to the Discovery tab
 * Useful when you want to direct users to the Discovery browser without opening a specific URL
 *
 * @example
 * ```ts
 * import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
 *
 * openUrlUtils.gotoDiscoveryTab();
 * ```
 */
export function gotoDiscoveryTab(): void {
  appGlobals.$navigationRef.current?.navigate(
    ERootRoutes.Main,
    {
      screen: ETabRoutes.Discovery,
    },
    {
      pop: true,
    },
  );
  if (platformEnv.isNative) {
    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.SwitchDiscoveryTabInNative, {
        tab: ETranslations.global_browser,
        openUrl: true,
      });
    }, 50);
  }
}

/**
 * Open a URL in the Discovery browser from anywhere in the app
 * Navigates to Discovery tab and opens the URL in a new browser tab
 *
 * @example
 * ```ts
 * import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
 *
 * // Open in Discovery browser (creates new tab in Discovery)
 * openUrlUtils.openUrlInDiscovery({
 *   url: 'https://uniswap.org',
 *   title: 'Uniswap'
 * });
 * ```
 */
export function openUrlInDiscovery(params: IOpenUrlInDiscoveryParams): void {
  const { url, title } = params;

  // Store URL and navigate to Discovery tab
  setPendingDiscoveryUrl(url, title);
  gotoDiscoveryTab();
}

/**
 * Open a fiat crypto (Onramper) URL in a WebView Modal on desktop/native,
 * with cross-domain navigation redirected to the Discovery browser.
 * On web/extension, falls back to opening externally.
 */
export function openFiatCryptoUrl(url: string, title?: string): void {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    appGlobals.$navigationRef.current?.navigate(ERootRoutes.Modal, {
      screen: EModalRoutes.WebViewModal,
      params: {
        screen: EModalWebViewRoutes.WebView,
        params: {
          url,
          title: title ?? '',
          redirectExternalNavigation: true,
          hideHeaderRight: true,
        },
      },
    });
  } else {
    openUrlExternal(url);
  }
}

const openUrlUtils = {
  openUrlByWebviewPro,
  openUrlInApp,
  openUrlExternal,
  dismissNativeInAppBrowser,
  openUrlInDiscovery,
  openFiatCryptoUrl,
  gotoDiscoveryTab,
  getPendingDiscoveryUrl,
  setPendingDiscoveryUrl,
  clearPendingDiscoveryUrl,
  openSettings,
  linkingCanOpenURL,
  linkingOpenURL,
};

export default openUrlUtils;
