export type IBrowserType = 'StandardBrowser' | 'MultiTabBrowser';

export interface IDAppItemType {
  _id: string;
  name: string;
  url: string;
  logoURL: string;
  subtitle: string;
  networkIds: string[];
  _subtitle?: string;
}

export interface IWebSiteHistory {
  title?: string;
  url?: string;
  favicon?: string;
}

export interface IMatchDAppItemType {
  id: string;
  dapp?: IDAppItemType;
  webSite?: IWebSiteHistory;
  clicks?: number;
  timestamp?: number;
  isNewWindow?: boolean;
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
