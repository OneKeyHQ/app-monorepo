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
  description: string;
  networkIds: string[];
  _subtitle?: string;
  // tags: { name: string; _id: string }[];
  // categories: { name: string; _id: string }[];
};

export type UrlInfo = {
  title?: string;
  icon?: string;
};

export type CatagoryType = {
  name: string;
  _id: string;
  _name?: string;
};

export type TagType = {
  name: string;
  _id: string;
  _name?: string;
};

export type TagDappsType = {
  label: string;
  _label: string;
  id: string;
  items: DAppItemType[];
};

export type ItemsType = {
  label: string;
  items: DAppItemType[];
};
export interface SectionDataType {
  title: string;
  _title?: string;
  data: DAppItemType[];
  tagId: string;
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
  MyDAppListModal = 'MyDAppListModal',
  EditBookmark = 'EditBookmark',
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
    _title?: string;
    tagId: string;
    onItemSelect?: (item: DAppItemType) => void;
  };
  [DiscoverModalRoutes.MyDAppListModal]: {
    defaultIndex?: number;
    onItemSelect?: (item: MatchDAppItemType) => void;
  };
  [DiscoverModalRoutes.EditBookmark]: {
    bookmark: BookmarkItem;
  };
};
