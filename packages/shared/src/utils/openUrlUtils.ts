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
} from '@onekeyhq/shared/src/routes';

import type { IPrefType } from '../../types/desktop';

const openUrlByWebview = (url: string, title?: string) => {
  globalThis.$navigationRef.current?.navigate(ERootRoutes.Modal, {
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
  if (platformEnv.isNative) {
    openUrlByWebview(url, title);
  } else {
    openUrlOutsideNative(url);
  }
};

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    void linkingOpenURL(url);
  } else {
    openUrlOutsideNative(url);
  }
};

export const openSettings = (prefType: IPrefType) => {
  if (platformEnv.isNative) {
    // android notification settings
    // Notifications.openSettingsAsync();
    void linkingOpenSettings();
  } else {
    globalThis?.desktopApi?.openPreferences(prefType);
  }
};

export default {
  openUrlInApp,
  openUrlExternal,
  openSettings,
  linkingCanOpenURL,
  linkingOpenURL,
};
