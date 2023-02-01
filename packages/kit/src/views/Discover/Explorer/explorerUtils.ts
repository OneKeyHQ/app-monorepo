import type { ReactNode } from 'react';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { appSelector } from '../../../store';

import type { DAppItemType, WebSiteHistory } from '../type';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type { WebView } from 'react-native-webview';

export interface WebSiteType {
  url?: string;
  title?: string;
  favicon?: string;
  historyId?: string;
}
export interface HistoryItem {
  logoURI: string;
  title: string;
  url: string;
}

export interface MatchDAppItemType {
  id: string;
  dapp?: DAppItemType;
  webSite?: WebSiteHistory;
  clicks?: number;
  timestamp?: number;
  isNewWindow?: boolean;
}

export interface WebControllerBarProps {
  loading?: boolean;
  onSearchSubmitEditing: (text: MatchDAppItemType | string) => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onNext?: () => void;
  onRefresh?: () => void;
  onStopLoading?: () => void;
  showExplorerBar?: boolean;
  onMore?: (value: boolean) => void;
  moreView?: ReactNode;
}

export type SearchViewKeyEventType = 'ArrowUp' | 'ArrowDown' | 'Enter';

export interface SearchViewRef {
  onKeyPress: (event: SearchViewKeyEventType) => boolean;
}
export interface SearchViewProps {
  visible: boolean;
  searchContent?: string;
  relativeComponent: any;
  onVisibleChange?: (visible: boolean) => void;
  onSelectorItem?: (item: MatchDAppItemType) => void;
  onHoverItem?: (item: MatchDAppItemType) => void;
  onSearchContentChange?: (searchContent: string) => void;
}

export type WebHandler = 'browser' | 'webview' | 'tabbedWebview';
export const webHandler: WebHandler = (() => {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return 'tabbedWebview';
  }
  return 'browser';
})();

export const isValidWebUrl = (url: string) =>
  /\.(ai|app|art|co|com|club|dev|ee|finance|game|im|info|io|is|it|net|network|news|org|so|xyz)(\/\S*)*$/.test(
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
    // TODO ref link
    return `https://www.google.com/search?q=${url}`;
  }

  return url;
};

export const webviewRefs: Record<string, IWebViewWrapperRef> = {};

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
}: {
  url?: string;
  title?: string;
  favicon?: string;
  isInPlace?: boolean;
  isNewWindow?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  id?: string;
}) => void;

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$webviewRefs = webviewRefs;
}
export function getWebviewWrapperRef({
  tabId,
}: {
  tabId: string | null | undefined;
}) {
  // DO NOT useMemo() here, as webviewRefs may be updated
  const ref = tabId ? webviewRefs[tabId] : null;
  return ref ?? null;
}

export function crossWebviewLoadUrl({
  url,
  tabId,
}: {
  url: string;
  tabId?: string;
}) {
  const wrapperRef = getWebviewWrapperRef({
    tabId,
  });
  debugLogger.webview.info('crossWebviewLoadUrl >>>>', url);
  if (platformEnv.isDesktop) {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (wrapperRef?.innerRef as IElectronWebView)?.loadURL(url).catch();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (wrapperRef?.innerRef as WebView)?.loadUrl(url);
  }
}
const getCurrentWebviewRef = () =>
  getWebviewWrapperRef({
    tabId: appSelector((s) => s.webTabs.currentTabId),
  });

const injectToPauseWebsocket = () => {
  if (globalThis.WebSocket) {
    // @ts-ignore
    if (!globalThis.$$wsSend) {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/unbound-method
      globalThis.$$wsSend = globalThis.WebSocket.prototype.send;
    }
    globalThis.WebSocket.prototype.send = () => {};
  }
};

const injectToResumeWebsocket = () => {
  if (
    globalThis.WebSocket &&
    // @ts-ignore
    globalThis.$$wsSend
  ) {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/unbound-method
    globalThis.WebSocket.prototype.send = globalThis.$$wsSend;
  }
};

export function pauseDappInteraction() {
  const ref = getCurrentWebviewRef();
  if (ref) {
    // pause jsbridge interaction
    if (ref.jsBridge) {
      ref.jsBridge.globalOnMessageEnabled = false;
    }
    // pause wallet connect websocket
    if (platformEnv.isNative) {
      (ref.innerRef as WebView)?.injectJavaScript(
        `(${injectToPauseWebsocket.toString()})()`,
      );
    }
    if (platformEnv.isDesktop) {
      (ref.innerRef as IElectronWebView)?.executeJavaScript(
        `(${injectToPauseWebsocket.toString()})()`,
      );
    }
  }
}

export function resumeDappInteraction() {
  const ref = getCurrentWebviewRef();
  if (ref) {
    // resume jsbridge interaction
    if (ref.jsBridge) {
      ref.jsBridge.globalOnMessageEnabled = true;
    }
    // resume wallet connect websocket
    if (platformEnv.isNative) {
      (ref.innerRef as WebView)?.injectJavaScript(
        `(${injectToResumeWebsocket.toString()})()`,
      );
    }
    if (platformEnv.isDesktop) {
      (ref.innerRef as IElectronWebView)?.executeJavaScript(
        `(${injectToResumeWebsocket.toString()})()`,
      );
    }
  }
}
