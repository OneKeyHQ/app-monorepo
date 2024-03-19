import type { IDApp } from '@onekeyhq/shared/types/discovery';

export type IBrowserType = 'StandardBrowser' | 'MultiTabBrowser';

export interface IBrowserHistory {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  logo?: string;
}

export interface IBrowserBookmark {
  title: string;
  url: string;
  logo?: string;
}

export interface IGotoSiteFnParams {
  url: string;
  title?: string;
  favicon?: string;
  dAppId?: string;
  isNewWindow?: boolean;
  isInPlace?: boolean;
  id?: string;
  userTriggered?: boolean;
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

export interface IWebTab {
  id: string;
  url: string;
  isActive?: boolean;
  title?: string;
  favicon?: string;
  thumbnail?: string;
  isBookmark?: boolean;
  isPinned?: boolean;
  pinnedTimestamp?: number;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  refReady?: boolean;
  timestamp?: number;
}

export interface IWebTabsAtom {
  tabs: IWebTab[];
  keys: string[];
}

export interface IMobileBottomOptionsProps {
  isBookmark: boolean;
  onBookmarkPress: (bookmark: boolean) => void;
  onRefresh: () => void;
  onShare: () => void;
  isPinned: boolean;
  onPinnedPress: (pinned: boolean) => void;
  onBrowserOpen: () => void;
  onGoBackHomePage: () => void;
  onCloseTab: () => void;
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
