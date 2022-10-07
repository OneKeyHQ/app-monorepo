import { ReactNode } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { DAppItemType } from '../type';

import type { WebSiteHistory } from '../type';

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
  dapp?: DAppItemType | undefined;
  webSite?: WebSiteHistory | undefined;
  clicks?: number | undefined;
  timestamp?: number | undefined;
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
  moreView: React.ReactNode;
}

export interface ExplorerViewProps extends WebControllerBarProps {
  explorerContent: ReactNode;
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
  if (platformEnv.isWeb || platformEnv.isExtension) {
    return 'browser';
  }
  if (platformEnv.isDesktop || platformEnv.isNativeIOSPad) {
    return 'tabbedWebview';
  }
  return 'webview';
})();

export const isValidDomain = (domain: string) =>
  /\.(ai|app|art|co|com|club|dev|ee|finance|game|im|info|io|is|it|net|network|news|org|xyz)$/.test(
    domain,
  );

export const validateUrl = (url: string) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (e) {
    if (isValidDomain(url)) {
      return `https://${url}`;
    }
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
}: {
  url?: string;
  title?: string;
  favicon?: string;
  isInPlace?: boolean;
  isNewWindow?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
}) => void;
