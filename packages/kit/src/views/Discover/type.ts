import type { MatchDAppItemType } from './Explorer/explorerUtils';

export type WebSiteHistory = {
  title?: string;
  url?: string;
  favicon?: string;
};

export type UserBrowserHistory = {
  url: string;
  title?: string;
  logoUrl?: string;
  dappId?: string;
  timestamp?: number;
};

export type DiscoverHistory = {
  webSite?: WebSiteHistory; // 手动输入的普通网站
  clicks: number;
  timestamp: number;
};

export type HistoryItemData = {
  clicks: number;
  timestamp: number;
};

export type DAppItemType = {
  _id: string;
  name: string;
  url: string;
  logoURL: string;
  subtitle: string;
  networkIds: string[];
  _subtitle?: string;
};

export type UrlInfo = {
  title?: string;
  icon?: string;
};

export type CategoryType = {
  name: string;
  id: string;
};

export type BannerType = {
  _id: string;
  title: string;
  description: string;
  networkIds: string[];
  url: string;
  logoURL: string;
};

export type GroupDappsType = {
  id: string;
  label: string;
  items: DAppItemType[];
};

export type ItemsType = {
  label: string;
  items: DAppItemType[];
};
export interface SectionDataType {
  id?: string;
  title: string;
  data: DAppItemType[];
  onItemSelect?: (item: DAppItemType) => void;
}

export type DAppListProps = {
  tagId: string;
  onItemSelect?: (item: DAppItemType) => void;
};

export type BookmarkItem = {
  id: string;
  url: string;
  icon?: string;
  title?: string;
};

export enum DiscoverModalRoutes {
  SearchHistoryModal = 'SearchHistoryModal',
  ShareModal = 'ShareModal',
  DAppListModal = 'DAppListModal',

  EditBookmark = 'EditBookmark',
  History = 'History',
  Favorites = 'Favorites',
  ChainSelector = 'ChainSelector',
  MobileTabs = 'MobileTabs',
}

export type DiscoverRoutesParams = {
  [DiscoverModalRoutes.SearchHistoryModal]: {
    url?: string;
    onSelectorItem?: (item: MatchDAppItemType | string) => void;
  };
  [DiscoverModalRoutes.ShareModal]: {
    url: string;
    name?: string;
    logoURL?: string;
  };
  [DiscoverModalRoutes.DAppListModal]: {
    title: string;
    tagId: string;
    onItemSelect?: (item: DAppItemType) => void;
  };
  [DiscoverModalRoutes.EditBookmark]: {
    bookmark: BookmarkItem;
  };
  [DiscoverModalRoutes.Favorites]: undefined;
  [DiscoverModalRoutes.History]: undefined;
  [DiscoverModalRoutes.ChainSelector]: {
    networkIds?: string[];
    currentNetworkId?: string;
    onSelect?: (networkId: string) => void;
  };
  [DiscoverModalRoutes.MobileTabs]: undefined;
};
