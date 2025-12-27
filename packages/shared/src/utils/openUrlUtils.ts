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

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    void linkingOpenURL(url.trim());
  } else {
    openUrlOutsideNative(url.trim());
  }
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

const openUrlUtils = {
  openUrlByWebviewPro,
  openUrlInApp,
  openUrlExternal,
  openUrlInDiscovery,
  gotoDiscoveryTab,
  getPendingDiscoveryUrl,
  setPendingDiscoveryUrl,
  openSettings,
  linkingCanOpenURL,
  linkingOpenURL,
};

export default openUrlUtils;
