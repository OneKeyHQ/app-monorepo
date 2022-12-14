import type { MatchDAppItemType } from './Explorer/explorerUtils';

export type WebSiteHistory = {
  title?: string;
  url?: string;
  favicon?: string;
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
  // tags: { name: string; _id: string }[];
  // categories: { name: string; _id: string }[];
};

export type ItemsType = {
  label: string;
  items: DAppItemType[];
};
export interface SectionDataType {
  title: string;
  data: DAppItemType[];
  tagId: string;
  onItemSelect?: (item: DAppItemType) => void;
}

export type DAppListProps = {
  tagId: string;
  onItemSelect?: (item: DAppItemType) => void;
};

export enum DiscoverModalRoutes {
  SearchHistoryModal = 'SearchHistoryModal',
  ShareModal = 'ShareModal',
  DAppListModal = 'DAppListModal',
  MyDAppListModal = 'MyDAppListModal',
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
  [DiscoverModalRoutes.MyDAppListModal]: {
    defaultIndex?: number;
    onItemSelect?: (item: MatchDAppItemType) => void;
  };
};
