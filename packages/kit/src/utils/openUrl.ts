import {
  openSettings as LinkingOpenSettings,
  openURL as LinkingOpenURL,
} from 'expo-linking';

import type { IPrefType } from '@onekeyhq/desktop/src-electron/preload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const openUrlByWebview = (
  url: string,
  title?: string,
  options?: {
    modalMode?: boolean;
  },
) => {
  // TODO: open url by webview
  console.log(url, title, options);
};

export const openUrl = (
  url: string,
  title?: string,
  options?: {
    modalMode?: boolean;
  },
) => {
  if (platformEnv.isNative) {
    openUrlByWebview(url, title, options);
  } else {
    window.open(url, '_blank');
  }
};

export const openUrlExternal = (url: string) => {
  if (platformEnv.isNative) {
    // open by OS default browser
    void LinkingOpenURL(url);
  } else {
    window.open(url, '_blank');
  }
};

export const openSettings = (prefType: IPrefType) => {
  if (platformEnv.isNative) {
    void LinkingOpenSettings();
  } else {
    window?.desktopApi?.openPreferences(prefType);
  }
};
