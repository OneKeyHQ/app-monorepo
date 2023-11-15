import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { DAppItemType, WebSiteHistory } from './types';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebView } from 'react-native-webview';

export interface MatchDAppItemType {
  id: string;
  dapp?: DAppItemType;
  webSite?: WebSiteHistory;
  clicks?: number;
  timestamp?: number;
  isNewWindow?: boolean;
}

export type WebHandler = 'browser' | 'tabbedWebview';
export const webHandler: WebHandler = (() => {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return 'tabbedWebview';
  }
  return 'browser';
})();

export const webviewRefs: Record<string, IWebViewWrapperRef> = {};

export interface IOnWebviewNavigationParams {
  url?: string;
  title?: string;
  favicon?: string;
  isInPlace?: boolean;
  isNewWindow?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  id?: string;
}
export type OnWebviewNavigation = ({
  url,
  title,
  favicon,
  isInPlace,
  isNewWindow,
  canGoBack,
  canGoForward,
  loading,
  id,
}: IOnWebviewNavigationParams) => void;

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$webviewRefs = webviewRefs;
}

export const isValidWebUrl = (url: string) =>
  /^[^/\s]+\.(?:ai|app|art|co|com|club|dev|ee|fi|finance|game|im|info|io|is|it|net|network|news|org|so|xyz)(?:\/[^/\s]*)*$/.test(
    url,
  );

export const validateUrl = (url: string) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (e) {
    if (isValidWebUrl(url)) {
      return `https://${url}`;
    }
    return `https://www.google.com/search?q=${url}`;
  }

  return url;
};
