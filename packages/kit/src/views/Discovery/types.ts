import {
  ESiteMode,
  type IBrowserBookmark,
  type IBrowserHistory,
  type IBrowserRiskWhiteList,
  type IDApp,
  type IWebTab,
  type IWebTabsAtom,
} from '@onekeyhq/shared/types/discovery';

export { ESiteMode };
export type {
  IBrowserBookmark,
  IBrowserHistory,
  IBrowserRiskWhiteList,
  IWebTab,
  IWebTabsAtom,
};

export type IBrowserType = 'StandardBrowser' | 'MultiTabBrowser';

export interface IGotoSiteFnParams {
  url: string;
  title?: string;
  favicon?: string;
  dAppId?: string;
  isNewWindow?: boolean;
  isInPlace?: boolean;
  id?: string;
  siteMode?: ESiteMode;
}

export interface IMatchDAppItemType {
  tabId?: string;
  dApp?: IDApp;
  webSite?: IBrowserBookmark | IBrowserHistory;
  clicks?: number;
  timestamp?: number;
  isNewWindow?: boolean;
}

export interface IOnWebviewNavigationFnParams {
  url?: string;
  title?: string;
  favicon?: string;
  isInPlace?: boolean;
  isNewWindow?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  id?: string;
  handlePhishingUrl?: (url: string) => void;
}
export type IOnWebviewNavigation = ({
  url,
  title,
  favicon,
  isInPlace,
  isNewWindow,
  canGoBack,
  canGoForward,
  loading,
  id,
  handlePhishingUrl,
}: IOnWebviewNavigationFnParams) => void;

export interface IMobileBottomOptionsProps {
  isBookmark: boolean;
  onBookmarkPress: (bookmark: boolean) => void;
  onShare: () => void;
  onCopyUrl: () => void;
  isPinned: boolean;
  onPinnedPress: (pinned: boolean) => void;
  onBrowserOpen: () => void;
  onMinimize: () => void;
  displayDisconnectOption: boolean;
  onDisconnect: () => void;
  siteMode?: ESiteMode;
  // Page actions folded into the menu by the mobile bottom bar.
  canGoForward: boolean;
  onGoForward: () => void;
  isTranslated: boolean;
  onTranslatePress: () => void;
  onRequestSiteMode: (siteMode: ESiteMode) => void;
}

export interface IMobileTabListOptionsProps {
  onBookmarkPress: (bookmark: boolean, url: string, title: string) => void;
  onShare: (url: string) => void;
  onPinnedPress: (id: string, pinned: boolean) => void;
  onClose: (id: string) => void;
}

export interface IMobileTabListEventProps {
  onBookmarkPress: (bookmark: boolean, url: string, title: string) => void;
  onShare: () => void;
  onPinnedPress: (id: string, pinned: boolean) => void;
}

export {
  ETranslateEngine,
  ETranslateDisplayMode,
} from '@onekeyhq/shared/types/discovery';
