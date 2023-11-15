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

export interface IBrowserHistory {
  title: string;
  url: string;
}

export interface IBrowserBookmark {
  title: string;
  url: string;
}

export interface IMatchDAppItemType {
  id: string;
  dapp?: IDAppItemType;
  webSite?: IBrowserHistory;
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
  handlePhishingUrl,
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
  handlePhishingUrl?: (url: string) => void;
}) => void;

export interface IWebTab {
  id: string;
  url: string;
  isActive?: boolean;
  title?: string;
  favicon?: string;
  thumbnail?: string;
  isBookmark?: boolean;
  isPined?: boolean;
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
  isPined: boolean;
  onPinedPress: (pined: boolean) => void;
  onCopyUrl: () => void;
  onBrowserOpen: () => void;
  onGoBackHomePage: () => void;
}
