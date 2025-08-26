import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

export type IBrowserType = 'StandardBrowser' | 'MultiTabBrowser';

export interface IBrowserHistory {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  logo?: string;
  titleMatch?: IFuseResultMatch;
  urlMatch?: IFuseResultMatch;
}

export interface IBrowserBookmark {
  title: string;
  url: string;
  logo: string | undefined;
  sortIndex: number | undefined;
}

export interface IBrowserRiskWhiteList {
  url: string;
}

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

export enum ESiteMode {
  desktop = 'desktop',
  mobile = 'mobile',
}

export interface IWebTab {
  id: string;
  url: string;
  displayUrl?: string; // URL for address bar display and UI functions (sharing, external browser)
  isActive?: boolean;
  title?: string;
  customTitle?: string;
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
  siteMode?: ESiteMode;
  type?: 'normal' | 'home';
}

export interface IWebTabsAtom {
  tabs: IWebTab[];
  keys: string[];
}

export interface IMobileBottomOptionsProps {
  disabled: boolean;
  isBookmark: boolean;
  onBookmarkPress: (bookmark: boolean) => void;
  onRefresh: () => void;
  onShare: () => void;
  onCopyUrl: () => void;
  isPinned: boolean;
  onPinnedPress: (pinned: boolean) => void;
  onBrowserOpen: () => void;
  onGoBackHomePage?: () => void;
  onCloseTab: () => void;
  displayDisconnectOption: boolean;
  onDisconnect: () => void;
  siteMode?: ESiteMode;
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
